export interface RawItem {
  /** RSS guid/link, or a content hash for the generic HTML connector.
   *  Unique per source — see src/db/schema.ts `source_items`. */
  externalId: string;
  url: string;
  title: string;
  summary?: string;
  publishedAt?: Date;
  /** og:image (HTML) or enclosure/media:content/inline <img> (RSS). */
  imageUrl?: string;
  /** The feed's own category names for this item (RSS <category>), if any. */
  categories?: string[];
}
