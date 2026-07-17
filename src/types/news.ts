export type NewsArticle = {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  source: 'HERO Sports';
};

export type NewsArticlesPayload = {
  articles: NewsArticle[];
  fetchedAt: string;
};
