'use strict';
const { google } = require('googleapis');
const cloudbuild = google.cloudbuild('v1');
const helper = require('./helper.js');

const BUCKET = "cloudbuild-files"
const CLOUDBUILD_FILE = "cloudbuild.yaml";

exports.buildlauncher = async (req, res) => {

  try { 
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const projectId = await google.auth.getProjectId();
    const { repo_name, repo_url, commit, branch } = await helper.getData(req);

    // Download cloudfile.yaml from a bucket
    const cloudbuild_config = await helper.downloadConfigFile(projectId, BUCKET, repo_name, CLOUDBUILD_FILE);

    // Adding git clone and git checkout as first steps
    cloudbuild_config.steps = helper.commonSteps(repo_url, commit).concat(cloudbuild_config.steps)

    // Adding substitutions
    cloudbuild_config.substitutions = helper.commonSubstitution(branch);

    const newOperation = await cloudbuild.projects.builds.create({
      auth, projectId, requestBody: cloudbuild_config });

    console.log(newOperation.data.name);

    } catch (error) {
      console.error(error);
    }

  res.status(200).send('Hello world');
}
