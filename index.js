const {google} = require('googleapis');
const cloudbuild = google.cloudbuild('v1');

exports.buildlauncher = async (req, res) => {
  const auth = await google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const projectId = await google.auth.getProjectId();

  const requestBody = {
    steps: [{
        name: "gcr.io/cloud-builders/gsutil",
        entrypoint: "bash",
        args: ["-c", "echo 'simple build from cloud function'"]
      }]
  };

  const newOperation = await cloudbuild.projects.builds.create({
    auth, projectId, requestBody });

  console.log(newOperation.data.name);
  res.status(200).send('Hello world');
}
