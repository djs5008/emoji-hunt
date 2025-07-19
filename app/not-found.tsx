/**
 * 404 Not Found Page
 * 
 * @description Custom 404 page that immediately redirects to the home page.
 * This provides a better user experience than showing a generic error page.
 * 
 * Use cases:
 * - Invalid lobby codes in URL
 * - Mistyped routes
 * - Expired or deleted lobbies
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Not Found handler component
 * 
 * @description Redirects users to home page when accessing invalid routes.
 * Returns null to prevent any flash of content during redirect.
 */
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page immediately
    router.replace('/');
  }, [router]);

  return null;
}