// src/app/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock, TrendingUp, Bookmark, Share2, Eye, Newspaper, Globe, Zap, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import WeatherWidget from "@/components/weather/weather-widget";
import LoanCalculator from "@/components/calculators/loan-calculator";
import { fetchCategories, fetchArticles, fetchTrending } from "../lib/api";

type BackendArticle = any;

// Function to sanitize ObjectIds from text fields
function sanitizeText(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') return '';
  
  // Remove MongoDB ObjectId patterns (24 hex characters)
  return text.replace(/\b[0-9a-fA-F]{24}\b/g, '').trim();
}

export default function HomePage() {
  const router = useRouter();

  const [featuredArticles, setFeaturedArticles] = useState<any[]>([]);
  const [latestArticles, setLatestArticles] = useState<any[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const [categoryArticles, setCategoryArticles] = useState<any[]>([]);
  const [languageSections, setLanguageSections] = useState<any[]>([]);
  const [uncategorizedArticles, setUncategorizedArticles] = useState<any[]>([]);
  const [rssLatestNews, setRssLatestNews] = useState<any[]>([]);
  const [latestNewsLoading, setLatestNewsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quickReads, setQuickReads] = useState<any[]>([]);
  const [moreStories, setMoreStories] = useState<any[]>([]);
  const [activeCalculator, setActiveCalculator] = useState<'personal' | 'education' | 'car' | 'home' | null>(null);  

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((prev) =>
        featuredArticles.length ? (prev + 1) % featuredArticles.length : 0
      );
    }, 5000);
    return () => clearInterval(t);
  }, [featuredArticles.length]);

  // Fetch RSS Latest News from database (trending category)
  useEffect(() => {
    let mounted = true;
    
    const fetchLatestNews = async () => {
      try {
        setLatestNewsLoading(true);
        const response = await fetch('/api/news/latest?lang=en&limit=15');
        const data = await response.json();
        if (mounted && data.success && data.articles && data.articles.length > 0) {
          setRssLatestNews(data.articles);
        } else if (mounted && data.articles) {
          setRssLatestNews([]);
        }
      } catch (error) {
        console.error('Error fetching latest news:', error);
        if (mounted) {
          setRssLatestNews([]);
        }
      } finally {
        if (mounted) {
          setLatestNewsLoading(false);
        }
      }
    };
    
    // Initial fetch
    fetchLatestNews();
    
    // Refresh every 5 minutes to get new articles
    const intervalId = setInterval(fetchLatestNews, 5 * 60 * 1000);
    
    return () => { 
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch only essential data in parallel for faster initial load
        const [rawArticles, trendingData] = await Promise.all([
          fetchArticles({ lang: 'en', limit: 12 }), // Limit initial fetch
          fetchTrending().catch(() => [])
        ]);
        
        const articlesList = Array.isArray(rawArticles) ? rawArticles : [];

        articlesList.sort((a: any, b: any) => {
          const ta = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const tb = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return tb - ta;
        });

        const mapped = articlesList.map(mapArticleToUi);

        if (!mounted) return;
        
        // Set featured and latest articles immediately
        const featured = mapped.slice(0, 3);
        if (featured.length === 0 && mapped.length > 0) {
          setFeaturedArticles(mapped.slice(0, Math.min(3, mapped.length)));
        } else {
          setFeaturedArticles(featured);
        }
        
        setLatestArticles(mapped.slice(0, 4));
        
        // Set trending topics
        if (trendingData && trendingData.topics && Array.isArray(trendingData.topics) && trendingData.topics.length > 0) {
          setTrendingTopics(trendingData.topics.slice(0, 6));
        } else if (Array.isArray(trendingData) && trendingData.length > 0) {
          const trendingTopics = trendingData.slice(0, 6).map((article: any, index: number) => ({
            name: article.title || `Trending ${index + 1}`,
            count: article.viewCount || Math.floor(Math.random() * 100) + 10,
            trend: "up" as const
          }));
          setTrendingTopics(trendingTopics);
        } else {
          setTrendingTopics(computeTrendingFromArticles(articlesList).slice(0, 6));
        }

        // Set quick reads (short articles for sidebar)
        const shortArticles = mapped.filter(a => a.readTime && a.readTime.includes('1 min')).slice(0, 5);
        setQuickReads(shortArticles.length > 0 ? shortArticles : mapped.slice(0, 5));

        // Load language sections in parallel - all languages
        const languages = ['en', 'hi', 'te', 'ta', 'bn', 'gu', 'mr'];
        const languageSectionsData: any[] = [];
        
        // Fetch all language sections in parallel instead of sequentially (keeps it fast)
        const languagePromises = languages.map(async (lang) => {
          try {
            const [langArticles, categories] = await Promise.all([
              fetch(`/api/news/latest?lang=${lang}&limit=20`).then(res => res.json()),
              fetch(`/api/categories?lang=${lang}`).then(res => res.json())
            ]);
            
            if (langArticles.success && langArticles.articles.length > 0) {
              const cats = categories.success ? (categories.categories || []) : [];
              const defaultCategoryKeys = ['politics', 'sports', 'business', 'entertainment', 'technology', 'health'];
              
              const normalizedCats = defaultCategoryKeys.map((key) => {
                const found = cats.find((c: any) => (c.key || '').toLowerCase() === key);
                if (found) return found;
                return {
                  name: key,
                  key,
                  displayName: key.charAt(0).toUpperCase() + key.slice(1),
                  articleCount: 0,
                };
              });
              
              return {
                language: lang,
                displayName: getLanguageDisplayName(lang),
                articles: langArticles.articles.map(mapArticleToUi),
                categories: normalizedCats
              };
            }
          } catch (err) {
            console.error(`Error fetching ${lang} articles:`, err);
          }
          return null;
        });

        const results = await Promise.all(languagePromises);
        const validResults = results.filter(r => r !== null);
        
        // Enforce display order: English → Hindi → Telugu → others in original order
        const langOrder: Record<string, number> = { en: 0, hi: 1, te: 2 };
        validResults.sort((a: any, b: any) => {
          const oa = langOrder[a.language] ?? 99;
          const ob = langOrder[b.language] ?? 99;
          return oa - ob;
        });
        
        if (mounted) setLanguageSections(validResults);
        
        // Get articles without images for "More Stories" section
        const articlesWithoutImages: any[] = [];
        validResults.forEach((section: any) => {
          section.articles.forEach((article: any) => {
            if (!article.thumbnail && !article.image) {
              articlesWithoutImages.push(article);
            }
          });
        });
        
        if (mounted) setMoreStories(articlesWithoutImages.slice(0, 8));

      } catch (err) {
        console.error("Error fetching articles:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // --- Helpers ---
  function getLanguageDisplayName(lang: string): string {
    const names: { [key: string]: string } = {
      'te': 'తెలుగు',
      'hi': 'हिन्दी',
      'en': 'English',
      'ta': 'தமிழ்',
      'ml': 'മലയാളം',
      'bn': 'বাংলা',
      'mr': 'मराठी',
      'gu': 'ગુજરાતી',
      'kn': 'ಕನ್ನಡ',
      'pa': 'ਪੰਜਾਬੀ'
    };
    return names[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  
  function mapArticleToUi(a: BackendArticle) {
    const id = a._id || a.id || a.hash || String(Math.random());
    const slug = a.slug || id;

    let image: string | null = null;
    try {
      // Check thumbnail first (this is what manual articles and scrapers set)
      if (a.thumbnail && typeof a.thumbnail === "string" && a.thumbnail.trim() !== '') {
        image = a.thumbnail;
      } else if (Array.isArray(a.images) && a.images.length > 0) {
        const first = a.images[0];
        if (typeof first === "string" && first.trim() !== '') image = first;
        else if (first?.url && first.url.trim() !== '') image = first.url;
        else if (first?.src && first.src.trim() !== '') image = first.src;
      } else if (a.image && typeof a.image === "string" && a.image.trim() !== '') {
        image = a.image;
      } else if (a.openGraph?.image && typeof a.openGraph.image === "string" && a.openGraph.image.trim() !== '') {
        image = a.openGraph.image;
      } else if (a.media && Array.isArray(a.media) && a.media[0]?.url && a.media[0].url.trim() !== '') {
        image = a.media[0].url;
      } else if (a.enclosures && Array.isArray(a.enclosures) && a.enclosures[0]?.url && a.enclosures[0].url.trim() !== '') {
        image = a.enclosures[0].url;
      }
    } catch (_) {}

    const title = sanitizeText(a.title) || "Untitled";
    const summary = sanitizeText(
      a.summary || (a.content ? truncate(stripHtml(a.content), 160) : "")
    );
    const publishedAt = a.publishedAt
      ? new Date(a.publishedAt)
      : a.createdAt
      ? new Date(a.createdAt)
      : new Date();
    const time = timeAgo(publishedAt);

    const readTime = estimateReadTime(a.content || a.summary || "");
    
    // Simplified category mapping - just use what backend provides
    let category = "General";
    if (typeof a.category === "object") {
      category = a.category.label || a.category.name || a.category.key || "General";
    } else if (a.category) {
      category = String(a.category);
    }
    
    // Capitalize first letter if needed
    if (category && category.length > 0) {
      category = category.charAt(0).toUpperCase() + category.slice(1);
    }

    const views = a.viewCount || a.views || 0;

    return {
      id,
      slug,
      title,
      summary,
      content: sanitizeText(a.content) || "",
      image, // can be null
      thumbnail: image, // also set thumbnail for consistency
      category,
      time,
      readTime,
      views,
      tags: a.tags || [],
      source: a.source || { name: 'Unknown' },
    };
  }

  function stripHtml(input: string) {
    return input.replace(/<\/?[^>]+(>|$)/g, "");
  }
  function truncate(s: string, n = 140) {
    return s.length > n ? s.slice(0, n).trim() + "…" : s;
  }
  function timeAgo(date: Date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months ago`;
    return `${Math.floor(months / 12)} years ago`;
  }
  function estimateReadTime(text: string) {
    if (!text) return "1 min read";
    const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(words / 200));
    return `${mins} min read`;
  }
  function computeTrendingFromArticles(articles: BackendArticle[]) {
    const categoryCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    
    // Count categories and tags from articles
    for (const a of articles || []) {
      // Count categories
      if (a.category) {
        const catKey = String(a.category).toLowerCase();
        categoryCounts[catKey] = (categoryCounts[catKey] || 0) + 1;
      }
      
      // Count tags
      const tags: string[] = a.tags || [];
      tags.forEach((t) => {
        if (!t) return;
        const key = String(t).toLowerCase();
        tagCounts[key] = (tagCounts[key] || 0) + 1;
      });
    }
    
    // Combine and sort by count
    const allCounts = { ...categoryCounts, ...tagCounts };
    const entries = Object.entries(allCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        count, 
        trend: "up" as const 
      }));
    
    // Return top trending topics or fallback
    return entries.length > 0 
      ? entries.slice(0, 6)
      : [
          { name: "Breaking News", count: Math.floor(Math.random() * 50) + 20, trend: "up" as const },
          { name: "World News", count: Math.floor(Math.random() * 40) + 15, trend: "up" as const },
          { name: "Technology", count: Math.floor(Math.random() * 35) + 10, trend: "up" as const },
          { name: "Sports", count: Math.floor(Math.random() * 30) + 8, trend: "up" as const },
          { name: "Politics", count: Math.floor(Math.random() * 25) + 5, trend: "up" as const },
          { name: "Health", count: Math.floor(Math.random() * 20) + 3, trend: "up" as const },
        ];
  }
  function deriveCategorySectionsFromArticles(mapped: any[]) {
    const groups: Record<string, any[]> = {};
    mapped.forEach((a) => {
      const cat = a.category || "General";
      groups[cat] = groups[cat] || [];
      if (groups[cat].length < 2) groups[cat].push(a);
    });
    return Object.entries(groups).map(([category, articles]) => ({
      category,
      articles: articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        time: a.time,
      })),
    }));
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 md:pt-28 pb-16">
        <div className="container mx-auto px-4">
          {/* Latest News - Professional Sleek Design with adjusted top spacing */}
          {latestNewsLoading ? (
            <section className="mb-6 md:mb-12">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-lg md:text-2xl font-bold text-foreground">Latest News</h2>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-xs md:text-sm text-muted-foreground">Loading...</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/latest-news')}
                    className="text-primary hover:text-primary/80 text-xs md:text-sm"
                  >
                    More
                  </Button>
                </div>
              </div>
              <div className="relative h-32 md:h-52 rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 border border-white/10 flex items-center justify-center">
                <div className="text-white text-xs md:text-sm">Loading latest news...</div>
              </div>
            </section>
          ) : rssLatestNews.length > 0 ? (
            <section className="mb-6 md:mb-12">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-lg md:text-2xl font-bold text-foreground">Latest News</h2>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-medium">Scroll.in</span>
                  <span className="text-xs md:text-sm text-muted-foreground hidden sm:inline">{rssLatestNews.length} stories</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/latest-news')}
                    className="text-primary hover:text-primary/80 text-xs md:text-sm"
                  >
                    More
                  </Button>
                </div>
              </div>
              <div className="relative h-32 md:h-52 rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 border border-white/10 shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10"></div>
                <div className="absolute inset-0 flex items-center">
                  <div className="flex gap-3 md:gap-6 animate-scroll px-3 md:px-6">
                    {[...rssLatestNews, ...rssLatestNews].map((item, index) => (
                      <Link
                        key={`rss-${index}`}
                        href={`/article/${item.slug}`}
                        className="group flex-shrink-0 w-[280px] md:w-[440px] bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-xl p-3 md:p-5 hover:from-white/15 hover:to-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 shadow-lg hover:shadow-xl"
                      >
                        <div className="flex items-start gap-2 md:gap-4 h-full">
                          {/* Modern Image Placeholder */}
                          <div className="flex-shrink-0 w-16 h-16 md:w-28 md:h-28 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 overflow-hidden border border-white/10 group-hover:scale-105 transition-transform duration-300">
                            <div className="w-full h-full flex items-center justify-center backdrop-blur-sm">
                              <svg className="w-6 h-6 md:w-10 md:h-10 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs md:text-base font-bold text-white line-clamp-2 mb-1 md:mb-2 group-hover:text-blue-200 transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-[10px] md:text-sm text-white/70 line-clamp-1 md:line-clamp-2 mb-1 md:mb-3 leading-relaxed">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-1 md:gap-2">
                              <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                                <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-[10px] md:text-xs text-white/70 font-medium">
                                  {new Date(item.pubDate).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="mb-6 md:mb-12">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-lg md:text-2xl font-bold text-foreground">Latest News</h2>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-primary/10 text-primary text-[10px] md:text-xs font-medium">Scroll.in</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/latest-news')}
                    className="text-primary hover:text-primary/80 text-xs md:text-sm"
                  >
                    More
                  </Button>
                </div>
              </div>
              <div className="relative h-32 md:h-52 rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 border border-white/10 shadow-2xl flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10"></div>
                <div className="relative text-center px-4">
                  <div className="text-white/90 text-sm md:text-base font-semibold mb-1 md:mb-2">No latest news available yet</div>
                  <div className="text-white/60 text-xs md:text-sm">Articles will appear here once scraped from Scroll.in</div>
                </div>
              </div>
            </section>
          )}

          {/* Featured (Removed - replaced by welcome banner) */}
          <section className="mb-12 hidden">
            <div className="relative h-96 md:h-[500px] rounded-2xl overflow-hidden">
              {featuredArticles.length > 0 ? (
                featuredArticles.map((article, index) => (
                  <motion.div key={`featured-${article.id || `fallback-${index}`}-${index}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: index === currentSlide ? 1 : 0 }} transition={{ duration: 0.5 }}>
                    {article.image ? (
                      <div
                        className="relative h-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${article.image})` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                          <Badge variant="secondary" className="mb-4">{sanitizeText(article.category)}</Badge>
                          <h1 className="text-3xl md:text-5xl font-bold mb-4">
                            <Link href={`/article/${article.slug}`} className="text-white no-underline">{article.title}</Link>
                          </h1>
                          <p className="text-lg md:text-xl mb-4 max-w-3xl">{article.summary}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{article.time}</div>
                            <div className="flex items-center gap-1"><Eye className="h-4 w-4" />{article.readTime}</div>
                            <Button variant="secondary" size="sm" onClick={() => router.push(`/article/${article.slug}`)}>
                              Read More <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white">
                        <div className="text-center p-8">
                          <Badge variant="secondary" className="mb-4">{sanitizeText(article.category)}</Badge>
                          <h1 className="text-3xl md:text-5xl font-bold mb-4">
                            <Link href={`/article/${article.slug}`} className="text-white no-underline">{article.title}</Link>
                          </h1>
                          <p className="text-lg md:text-xl mb-4 max-w-3xl">{article.summary}</p>
                          <div className="flex items-center gap-4 text-sm justify-center">
                            <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{article.time}</div>
                            <div className="flex items-center gap-1"><Eye className="h-4 w-4" />{article.readTime}</div>
                            <Button variant="secondary" size="sm" onClick={() => router.push(`/article/${article.slug}`)}>
                              Read More <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="relative h-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white">
                  <div className="text-center p-8">
                    <h1 className="text-3xl md:text-5xl font-bold mb-4">Welcome to NewsHub</h1>
                    <p className="text-lg md:text-xl mb-4 max-w-3xl">Stay updated with the latest news from around the world</p>
                    <Button variant="secondary" size="lg" onClick={() => router.push('/news')}>
                      Explore News <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Main Layout - Mobile First: Content then Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
            {/* Sidebar - Shows After Content on Mobile */}
            <div className="lg:col-span-1 space-y-4 md:space-y-6 order-2 lg:order-1">
              {/* Weather Widget */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="hidden lg:block"
              >
                <WeatherWidget />
              </motion.div>
              
              {/* Trending Topics - Modern Redesign */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Trending Topics</h3>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-1">
                    {trendingTopics.map((topic: any, index: number) => (
                      <motion.div
                        key={`trending-${topic.name}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group"
                      >
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 cursor-pointer">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              {index + 1}
                            </span>
                            <span className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                              {topic.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full min-w-[2rem] text-center">
                              {topic.count}
                            </span>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              topic.trend === "up" ? "bg-green-500" : 
                              topic.trend === "down" ? "bg-red-500" : 
                              "bg-gray-400"
                            }`} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* More Stories - Articles without images (like in the screenshot) */}
              {moreStories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-4 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">More Stories</h3>
                        <Badge variant="secondary" className="ml-auto text-xs">No images</Badge>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-1">
                      {moreStories.slice(0, 6).map((article: any, index: number) => (
                        <motion.div
                          key={`more-story-${article.id || `fallback-${index}`}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Link 
                            href={`/article/${article.slug}`}
                            className="block group"
                          >
                            <div className="p-3 rounded-lg hover:bg-accent/50 transition-all duration-200 border-b border-border/30 last:border-0">
                              <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors leading-snug mb-2">
                                {article.title}
                              </h4>
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                                {article.summary}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{article.time}</span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                      {moreStories.length > 6 && (
                        <div className="pt-3 border-t border-border/50 mt-2">
                          <Link 
                            href="/news"
                            className="flex items-center justify-between text-sm text-primary hover:text-primary/80 font-medium transition-colors py-2 px-3 rounded-lg hover:bg-primary/5 group"
                          >
                            <span>View all stories</span>
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Quick Reads Section */}
              {quickReads.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-4 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Quick Reads</h3>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      {quickReads.slice(0, 5).map((article: any, index: number) => (
                        <motion.div
                          key={`quick-read-${article.id || index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Link 
                            href={`/article/${article.slug}`}
                            className="block group"
                          >
                            <div className="p-2.5 rounded-lg hover:bg-accent/50 transition-all duration-200">
                              <h4 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors leading-snug mb-1.5">
                                {article.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="secondary" className="text-xs px-2 py-0">
                                  {article.readTime}
                                </Badge>
                                <span>•</span>
                                <span>{article.time}</span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Useful Tools Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Useful</h3>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Personal Loan', type: 'personal' as const, icon: '👤', color: 'from-blue-500/10 to-blue-600/10 hover:from-blue-500/20 hover:to-blue-600/20 border-blue-500/20' },
                        { name: 'Education Loan', type: 'education' as const, icon: '🎓', color: 'from-green-500/10 to-green-600/10 hover:from-green-500/20 hover:to-green-600/20 border-green-500/20' },
                        { name: 'Car Loan', type: 'car' as const, icon: '🚗', color: 'from-purple-500/10 to-purple-600/10 hover:from-purple-500/20 hover:to-purple-600/20 border-purple-500/20' },
                        { name: 'Home Loan', type: 'home' as const, icon: '🏠', color: 'from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20 border-orange-500/20' }
                      ].map((tool, index) => (
                        <motion.div
                          key={`tool-${tool.name}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={`w-full h-auto py-3 px-2 flex flex-col items-center gap-2 bg-gradient-to-br ${tool.color} border transition-all duration-300 hover:scale-105 hover:shadow-md`}
                            onClick={() => setActiveCalculator(tool.type)}
                          >
                            <span className="text-2xl">{tool.icon}</span>
                            <span className="text-xs font-semibold text-center leading-tight">{tool.name}</span>
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Advertisement Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardContent className="p-0">
                    <div className="aspect-square relative overflow-hidden">
                      <img 
                        src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop" 
                        alt="Advertisement" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <Badge variant="secondary" className="mb-2 text-xs">Sponsored</Badge>
                        <h3 className="text-white font-bold text-lg mb-1">Grow Your Business</h3>
                        <p className="text-white/90 text-sm mb-3">Reach millions of readers worldwide</p>
                        <Button size="sm" variant="secondary" className="w-full">
                          Learn More →
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Popular Categories */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 backdrop-blur-sm">
                        <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Popular Categories</h3>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Politics', count: '1.2k', color: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-600' },
                        { name: 'Technology', count: '856', color: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-600' },
                        { name: 'Sports', count: '742', color: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-600' },
                        { name: 'Entertainment', count: '698', color: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 text-purple-600' },
                        { name: 'Business', count: '534', color: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20 text-orange-600' },
                        { name: 'Health', count: '421', color: 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 text-pink-600' }
                      ].map((category, index) => (
                        <motion.div
                          key={`popular-cat-${category.name}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Link href={`/news?category=${category.name.toLowerCase()}`}>
                            <div className={`${category.color} border rounded-lg p-3 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-md`}>
                              <div className="font-semibold text-sm mb-1">{category.name}</div>
                              <div className="text-xs opacity-70">{category.count} articles</div>
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Contact Email */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                        <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold mb-2">Contact Us</h3>
                      <p className="text-sm text-muted-foreground mb-4">Get in touch for news tips or inquiries</p>
                    </div>
                    <a href="mailto:team.newshub@outlook.com" className="block">
                      <Button className="w-full gap-2">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        team.newshub@outlook.com
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Main Content Area - Shows First on Mobile */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              {/* Articles Without Images - Featured General News */}
              {uncategorizedArticles.length > 0 && (
                <section className="mb-12">
                  <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                    <div className="flex items-center gap-3">
                      <Newspaper className="h-6 w-6 text-primary" />
                      <h2 className="text-2xl font-bold text-foreground">Featured Stories</h2>
                    </div>
                    <Link 
                      href="/news" 
                      className="text-primary hover:text-primary/80 font-medium text-sm transition-colors flex items-center gap-1 group"
                    >
                      <span>View All</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {uncategorizedArticles.slice(0, 6).map((article: any, index: number) => (
                      <motion.div
                        key={`featured-general-${article.id || `fallback-${index}`}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                      >
                        <Link href={`/article/${article.slug}`} className="group block">
                          <Card className="h-full border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300">
                            <CardContent className="p-5">
                              <div className="flex items-start gap-4">
                                {article.thumbnail ? (
                                  <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
                                    <img 
                                      src={article.thumbnail} 
                                      alt={article.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/20">
                                    <Newspaper className="h-10 w-10 text-primary/40" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {sanitizeText(article.category)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{article.time}</span>
                                  </div>
                                  <h3 className="font-bold text-base line-clamp-2 group-hover:text-primary transition-colors mb-2 leading-snug">
                                    {article.title}
                                  </h3>
                                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {article.summary}
                                  </p>
                                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      <span>{article.readTime}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* Language-Specific News Sections */}
              <div className="space-y-16">
                {languageSections.map((section) => (
                  <section key={section.language} className="space-y-6">
                    {/* Section Header */}
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <h2 className="text-2xl font-bold text-foreground">
                        {section.displayName} News
                      </h2>
                      <Link 
                        href={`/news?lang=${section.language}`} 
                        className="text-primary hover:text-primary/80 font-medium text-sm transition-colors"
                      >
                        View All →
                      </Link>
                    </div>
                    
                    {/* Category Filter Buttons */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      <Link href={`/news?lang=${section.language}`}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs"
                        >
                          All
                        </Button>
                      </Link>
                      {(() => {
                        const categories = Array.isArray(section.categories) ? section.categories : [];
                        // For Telugu, only show selected categories; others removed as requested
                        const filtered = section.language === 'te'
                          ? categories.filter((c: any) => ['politics','entertainment','sports','health','andhra-pradesh','crime','business'].includes((c.key || c.name || '').toLowerCase()))
                          : categories;
                        return filtered.slice(0, 8).map((cat: any) => (
                          <Link key={cat.name} href={`/news?lang=${section.language}&category=${cat.name}`}>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-xs"
                            >
                              {cat.displayName}
                            </Button>
                          </Link>
                        ));
                      })()}
                    </div>
                    
                    {/* Articles Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {section.articles.slice(0, 6).map((article: any, index: number) => (
                        <Card key={`home-${section.language}-${article.id || `fallback-${index}`}-${index}`} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border">
                          <Link href={`/article/${article.slug}`} className="block">
                            <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
                              {article.thumbnail ? (
                                <img 
                                  src={article.thumbnail} 
                                  alt={article.title} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground font-medium">No Image</span>
                                </div>
                              )}
                            </div>
                            <CardContent className="p-4 space-y-3">
                              {/* Article Meta */}
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs font-medium">
                                  {sanitizeText(article.category) || 'General'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{article.time}</span>
                              </div>
                              
                              {/* Article Title */}
                              <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                {article.title}
                              </h3>
                              
                              {/* Article Summary */}
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {article.summary}
                              </p>
                              
                              {/* Article Footer */}
                              <div className="flex items-center justify-end pt-2 border-t border-border/50">
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent">
                                    <Bookmark className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-accent">
                                    <Share2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Link>
                        </Card>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
      
      {/* Loan Calculator Modal */}
      {activeCalculator && (
        <LoanCalculator 
          type={activeCalculator} 
          onClose={() => setActiveCalculator(null)} 
        />
      )}
    </div>
  );
}
