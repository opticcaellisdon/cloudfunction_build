const {google} = require('googleapis');
const cloudbuild = google.cloudbuild('v1');

exports.buildlauncher = async (req, res) => {
  const auth = await google.auth.getClient({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const projectId = await google.auth.getProjectId();

  const previousBuilds = await cloudbuild.projects.builds.list({auth, projectId, pageSize: 5});

  console.log(previousBuilds.data);
  console.log(req.body);
  res.status(200).send('Hello world');
}
