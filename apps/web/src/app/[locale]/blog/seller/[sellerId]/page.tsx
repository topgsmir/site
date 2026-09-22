import { BlogListing, blogListingMetadata, type BlogListingProps } from "@/lib/blog-listing";

export function generateMetadata(props: BlogListingProps) { return blogListingMetadata(props, "sellers"); }
export default function Page(props: BlogListingProps) { return <BlogListing {...props} kind="sellers" />; }
