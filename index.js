const {google} = require('googleapis');
const cloudbuild = google.cloudbuild('v1');

exports.buildlauncher = async (req, res) => {
  const auth = await google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const projectId = await google.auth.getProjectId();

  const event = req.get('X-GitHub-Event');
  const repository = req.body.repository;

  if (event == "push") {
    console.log("Push event");

    const requestBody = {
      steps: [
        {
          name: "gcr.io/cloud-builders/gsutil",
          entrypoint: "bash",
          args: ["-c", "echo 'simple build from cloud function'"]
        },
        {
          name: "gcr.io/cloud-builders/git",
          args: ["clone", `${repository.clone_url}`, '.']
        },
        {
          name: "gcr.io/cloud-builders/git",
          args: ["checkout", `${req.body.head_commit.id}`]
        },
        {
          name: "gcr.io/cloud-builders/git",
          args: ["log", "--oneline"]
        }
      ]
    };

    const newOperation = await cloudbuild.projects.builds.create({
      auth, projectId, requestBody });

    console.log(newOperation.data.name);
  }

  res.status(200).send('Hello world');
}
