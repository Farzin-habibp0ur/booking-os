import fs from 'fs';

jest.mock('remark', () => ({
  remark: () => ({
    use: () => ({
      process: jest.fn().mockResolvedValue({
        toString: () => '<h1>Hello World</h1>\n<p>This is post one content.</p>',
      }),
    }),
  }),
}));
jest.mock('remark-html', () => ({ default: 'remark-html-plugin' }));
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

import { getAllPosts, getPostBySlug, getAllSlugs } from './blog';

const POST_1 = `---
title: "Post One"
description: "Description one"
date: "2026-03-01"
category: "Technical"
author: "Author A"
readTime: "5 min read"
---

# Hello World

This is post one content.
`;

const POST_2 = `---
title: "Post Two"
description: "Description two"
date: "2026-02-15"
category: "Industry Insights"
author: "Author B"
readTime: "3 min read"
---

Some content here.
`;

describe('blog utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.readdirSync.mockReturnValue([
      'post-one.md' as any,
      'post-two.md' as any,
      'readme.txt' as any,
    ]);
  });

  describe('getAllPosts', () => {
    it('returns posts sorted by date descending', () => {
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (filePath.includes('post-one')) return POST_1;
        if (filePath.includes('post-two')) return POST_2;
        return '';
      });

      const posts = getAllPosts();
      expect(posts).toHaveLength(2);
      expect(posts[0].slug).toBe('post-one');
      expect(posts[1].slug).toBe('post-two');
      expect(posts[0].title).toBe('Post One');
      expect(posts[0].category).toBe('Technical');
    });

    it('filters out non-md files', () => {
      mockFs.readFileSync.mockReturnValue(POST_1);
      const posts = getAllPosts();
      expect(posts).toHaveLength(2);
    });
  });

  describe('getPostBySlug', () => {
    it('returns post with rendered HTML content', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(POST_1);

      const post = await getPostBySlug('post-one');
      expect(post).not.toBeNull();
      expect(post!.title).toBe('Post One');
      expect(post!.slug).toBe('post-one');
      expect(post!.contentHtml).toContain('Hello World');
    });

    it('returns null for non-existent slug', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const post = await getPostBySlug('does-not-exist');
      expect(post).toBeNull();
    });
  });

  describe('getAllSlugs', () => {
    it('returns slugs without .md extension', () => {
      const slugs = getAllSlugs();
      expect(slugs).toEqual(['post-one', 'post-two']);
    });
  });
});
