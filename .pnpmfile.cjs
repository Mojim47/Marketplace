module.exports = {
  hooks: {
    readPackage(pkg) {
      if (process.env.DOCKER_BUILD === '1') {
        ['puppeteer', 'playwright', 'onnxruntime-node'].forEach((d) => {
          if (pkg.name === d && pkg.scripts) {
            delete pkg.scripts.postinstall;
            delete pkg.scripts.install;
          }
        });
      }
      return pkg;
    },
  },
};
