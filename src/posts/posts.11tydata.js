// Every post keeps its old WordPress URL: /<slug>/
export default {
  layout: 'layouts/post.njk',
  permalink: data => `/${data.page.fileSlug}/`,
};
