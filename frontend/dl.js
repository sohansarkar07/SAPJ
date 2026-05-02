const https = require('https');
const fs = require('fs');

function download(url, filename) {
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      fs.writeFileSync(filename, data);
      console.log('Downloaded ' + filename);
    });
  });
}

download('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzUxZTFjODY4YTk4OTQzMDBhY2JmZjhiM2Q5NzVkM2U1EgsSBxCviN39lQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxMTc1MzgzMDExMDk4MDA5NzQwMQ&filename=&opi=89354086', 'dashboard_orig.html');
download('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzk3Y2Q5Y2U2MTRkZDQxZWU5NGM2ZDIyMGQxZGE0YWI5EgsSBxCviN39lQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxMTc1MzgzMDExMDk4MDA5NzQwMQ&filename=&opi=89354086', 'sources_orig.html');
