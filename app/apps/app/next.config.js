/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@leyfis/shared'],
  async redirects() {
    return [
      { source: '/', destination: '/landing.html', permanent: false },
    ];
  },
};
