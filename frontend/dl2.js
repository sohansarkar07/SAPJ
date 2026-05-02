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

download('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzJmMzU0YmI1NTJjNjRmMDY4MmU1YmRkMDc5MDQ0OWFjEgsSBxCviN39lQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxMTc1MzgzMDExMDk4MDA5NzQwMQ&filename=&opi=89354086', 'landing_orig.html');
download('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2Y1ZGFhZTdmNzA0YzRjODBhN2RkZjI4NmZiNDllNDc3EgsSBxCviN39lQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxMTc1MzgzMDExMDk4MDA5NzQwMQ&filename=&opi=89354086', 'search_orig.html');
download('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2FmY2RkNjQxYzI2YjRjYmFhNWI3ZTJhOThkNzZhODI3EgsSBxCviN39lQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxMTc1MzgzMDExMDk4MDA5NzQwMQ&filename=&opi=89354086', 'grant_orig.html');
download('https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzE0ZTJmMzc3NjhhZDQ4ZTQ4ODU4ODZmMGNmY2E0NGNkEgsSBxCviN39lQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxMTc1MzgzMDExMDk4MDA5NzQwMQ&filename=&opi=89354086', 'settings_orig.html');
