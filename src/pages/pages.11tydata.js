// Every page keeps its old WordPress URL: /<slug>/
export default {
  layout: 'layouts/page.njk',
  permalink: data => `/${data.page.fileSlug}/`,
};
