'use strict';
const { Storage } = require('@google-cloud/storage');
const yaml = require('js-yaml');
const octokit = require('@octokit/rest')();
const _ = require('lodash');

const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const CONSTANT_BRANCHES = ["master", "develop"];

octokit.authenticate({
      type: 'token',
      token: GITHUB_ACCESS_TOKEN
    });

// Express Request (Github event) -> Promise
// Resolve to an object ({ repo_name, repo_url, commit }) with 
//  - the repository name
//  - the repository URL
//  - and commit 
// Reject to an Error with a reason
async function getData(req) {

  const event = req.get('X-GitHub-Event');

  if (_.isEqual(event, "push")) {
    const repo_url = req.body.repository.ssh_url;
    const repo_name = req.body.repository.name;
    const commit = req.body.head_commit.id;
    const branch = getBranch(req.body);
    const owner = getOwner(req.body);
    const pr_branches = await getPRbranches(owner, repo_name);
    const allowed_branches = pr_branches.concat(CONSTANT_BRANCHES);

    if (_.includes(allowed_branches, branch)) {
      return Promise.resolve({ repo_name, repo_url, commit, branch });
    } else {
      return Promise.reject( new Error("The push wasn't in a allowed branch"));
    }

  } else if (_.isEqual(event, "pull_request") && req.body.action == "opened") {
    const repo_url = req.body.repository.ssh_url;
    const repo_name = req.body.repository.name;
    const commit = req.body.pull_request.head.sha;
    const branch = getBranch(req.body);
    return Promise.resolve({ repo_name, repo_url, commit, branch });

  } else {
    return Promise.reject(new Error('not push event or pull request opening'));
  }

}

// String, String, String, String -> Cloud Build resource
// This function download a Cloudbuild.yaml from Google Cloud Storage
async function downloadConfigFile(projectId, bucket_name, repo_name, filename) {
  const storage = new Storage({
    projectId: projectId
  });

  const bucket = storage.bucket(bucket_name);
  const file = await bucket.file(`${repo_name}/${filename}`).download();
  return yaml.safeLoad(file);
}

// String, String -> [String]
// Return a two-array of cloud build steps with the clone and checkout steps
function commonSteps(repo_url, commit) {
  return [
    {
      name: "gcr.io/cloud-builders/gsutil",
      args: [
				"cp",
				"gs://kms-encrypted-files/id_rsa.enc",
        "/root/.ssh/id_rsa.enc"
			],
      volumes: [{ name: "ssh", path: "/root/.ssh" }]
    },
    {
      name: "gcr.io/cloud-builders/gsutil",
      args: [
				"cp",
				"gs://kms-encrypted-files/known_hosts",
        "/root/.ssh/known_hosts"
			],
      volumes: [{ name: "ssh", path: "/root/.ssh" }]
    },
    {
      name: "gcr.io/cloud-builders/gcloud",
      args: [
        "kms",
        "decrypt",
        "--ciphertext-file=/root/.ssh/id_rsa.enc",
        "--plaintext-file=/root/.ssh/id_rsa",
        "--location=global",
        "--keyring=my-keyrings",
        "--key=github-key"
      ],
      volumes: [{ name: "ssh", path: "/root/.ssh" }]
    },
    {
      name: "gcr.io/cloud-builders/git",
      entrypoint: "bash",
      args: [
        "-c",
        "chmod 600 /root/.ssh/id_rsa\ncat <<EOF >/root/.ssh/config\nHostname github.com\nIdentityFile /root/.ssh/id_rsa\nEOF\n"
      ],
      volumes: [{ "name": "ssh", "path": "/root/.ssh" }]
    },
    {
      name: "gcr.io/cloud-builders/git",
      args: ["clone", `${repo_url}`, '.'],
      volumes: [{ "name": "ssh", "path": "/root/.ssh" }]
    },
    {
      name: "gcr.io/cloud-builders/git",
      args: ["checkout", `${commit}`]
    }
  ]
}

// Github payload -> String
// This function get the branch that was updated with a push
function getBranch(payload) {

  if ( payload.ref ) {
    // ref example: "refs/tags/simple-tag", this will get the last string
    return payload.ref.split("/")[2];
  } else {
    return payload.pull_request.head.ref;
  }

}

// Github payload -> String
// This function return the repository owner
function getOwner(payload) {
  return ( payload.repo || payload.repository ).owner.login;
}

// String, String -> [ String ]
// This function return an array with the branches of the open Pull Requests
async function getPRbranches(owner, repo){
  const pull_requests = (await octokit.pulls.list({owner, repo})).data;
  return _.map(pull_requests, (value) => _.get(value, "head.ref")); 
}

function commonSubstitution(branch) {
  return { BRANCH_NAME: branch };
}

module.exports.getData = getData;
module.exports.commonSteps = commonSteps;
module.exports.downloadConfigFile = downloadConfigFile;
module.exports.commonSubstitution = commonSubstitution;
