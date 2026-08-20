import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { ACTIVE_YEAR, SITE_DESCRIPTION, SITE_TITLE } from "@/config";
import { getWeekYearAndSlug, isPublishedWeek } from "@/lib/course-content";

export async function GET(context) {
  const posts = (await getCollection("weeks"))
    .filter(isPublishedWeek)
    .filter((post) => getWeekYearAndSlug(post.id).year === ACTIVE_YEAR)
    .filter((post) => post.data.week !== 0 && post.data.page !== false);

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/${getWeekYearAndSlug(post.id).slug}/`,
    })),
  });
}
