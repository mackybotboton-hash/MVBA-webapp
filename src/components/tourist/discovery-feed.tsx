"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Image from "next/image";
import { MapPin, Star, User, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingRequestModal } from "./booking-request-modal";

export interface FeedProperty {
  id: string;
  name: string;
  type: string;
  address: string;
  cover_image_url: string;
  promo_video_url?: string;
  rating?: number;
  rooms: { id: string; name: string; base_price: number; max_capacity: number }[];
}

interface DiscoveryFeedProps {
  initialData: FeedProperty[];
  fetchMore: (offset: number) => Promise<FeedProperty[]>;
  totalCount: number;
}

export function DiscoveryFeed({ initialData, fetchMore, totalCount }: DiscoveryFeedProps) {
  const [properties, setProperties] = useState<FeedProperty[]>(initialData);
  const [isFetching, setIsFetching] = useState(false);
  const [activePropertyIndex, setActivePropertyIndex] = useState(0);
  
  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<FeedProperty | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: properties.length + (properties.length < totalCount ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => window.innerHeight, // Each item takes exactly 100vh
    overscan: 1, // Only render 1 item off-screen to preserve memory on mobile
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Load more data when scrolling near the end
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= properties.length - 1 &&
      !isFetching &&
      properties.length < totalCount
    ) {
      setIsFetching(true);
      fetchMore(properties.length).then((newData) => {
        setProperties((prev) => [...prev, ...newData]);
        setIsFetching(false);
      });
    }
  }, [virtualItems, isFetching, properties.length, totalCount, fetchMore]);

  // Track the currently active video based on scroll position
  useEffect(() => {
    if (parentRef.current) {
      const handleScroll = () => {
        const index = Math.round(parentRef.current!.scrollTop / window.innerHeight);
        if (index !== activePropertyIndex) {
          setActivePropertyIndex(index);
        }
      };
      
      const el = parentRef.current;
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [activePropertyIndex]);

  const handleBookClick = (property: FeedProperty) => {
    setSelectedProperty(property);
    setBookingModalOpen(true);
  };

  const handleBookingSubmit = async (payload: any) => {
    // Booking submission handled here (calling server action or API)
    console.log("Submitting booking:", payload);
    setBookingModalOpen(false);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden">
      
      {/* 
        Virtualization Container:
        CSS Scroll Snapping is applied here. It guarantees a TikTok-like feel.
      */}
      <div 
        ref={parentRef} 
        className="w-full h-full overflow-y-auto snap-y snap-mandatory touch-pan-y scroll-smooth hide-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index > properties.length - 1;
            const property = properties[virtualRow.index];
            const isActive = virtualRow.index === activePropertyIndex;

            return (
              <div
                key={virtualRow.index}
                className="absolute top-0 left-0 w-full h-[100dvh] snap-center snap-always flex items-center justify-center bg-black"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {isLoaderRow ? (
                  <div className="flex flex-col items-center justify-center text-white/50">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                    <p className="text-sm font-medium tracking-wide">Loading more places...</p>
                  </div>
                ) : (
                  <FeedCard 
                    property={property} 
                    isActive={isActive}
                    onBook={() => handleBookClick(property)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking Modal triggers outside the feed item to prevent layout bugs */}
      {selectedProperty && (
        <BookingRequestModal 
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          rooms={selectedProperty.rooms}
          onSubmit={handleBookingSubmit}
        />
      )}
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

// ----------------------------------------------------------------------------
// FeedCard Component
// Extracts the complex DOM for a single swipeable item, managing video state.
// ----------------------------------------------------------------------------
function FeedCard({ property, isActive, onBook }: { property: FeedProperty, isActive: boolean, onBook: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle Video Autoplay
  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.log("Autoplay blocked:", e));
    } else if (!isActive && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-full max-w-lg mx-auto bg-black overflow-hidden">
      
      {/* Background Media */}
      <div className="absolute inset-0 w-full h-full">
        {property.promo_video_url ? (
          <video
            ref={videoRef}
            src={property.promo_video_url}
            className="object-cover w-full h-full opacity-90"
            loop
            muted
            playsInline
            preload="metadata"
            poster={property.cover_image_url}
          />
        ) : (
          <Image
            src={property.cover_image_url || '/placeholder-room.jpg'}
            alt={property.name}
            fill
            sizes="100vw, (min-width: 768px) 500px"
            className="object-cover w-full h-full opacity-90"
            priority={isActive}
          />
        )}
        
        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90 pointer-events-none" />
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-6 pb-24 md:pb-6 flex flex-col justify-end">
        <div className="flex justify-between items-end gap-4">
          
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                {property.type}
              </span>
              {property.rating && (
                <div className="flex items-center gap-1 text-yellow-400 font-medium text-sm drop-shadow-md">
                  <Star className="w-4 h-4 fill-current" /> {property.rating}
                </div>
              )}
            </div>
            
            <h1 className="text-3xl font-bold text-white drop-shadow-lg leading-tight">
              {property.name}
            </h1>
            
            <p className="text-white/80 text-sm font-medium flex items-center gap-1.5 drop-shadow-sm">
              <MapPin className="w-4 h-4" /> {property.address}
            </p>
          </div>

          {/* Action Buttons (Right Aligned, Stacked on mobile) */}
          <div className="flex flex-col items-center gap-4">
            <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 active:scale-95 transition-transform">
              <Info className="w-6 h-6" />
            </button>
            <Button 
              size="icon"
              className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] active:scale-95 transition-transform border-2 border-white/20"
              onClick={onBook}
            >
              Book
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
