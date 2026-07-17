export type NewsSource = 'HERO Sports' | 'The Analyst';

export type NewsArticle = {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;
  source: NewsSource;
};

export type NewsArticlesPayload = {
  articles: NewsArticle[];
  fetchedAt: string;
};
