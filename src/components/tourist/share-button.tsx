"use client";

import * as React from "react";
import { Share2, Copy, Mail, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  propertyName: string;
  propertyDescription?: string;
  propertyId: string;
}

export function ShareButton({ propertyName, propertyDescription, propertyId }: ShareButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  
  // We compute the URL here so it's guaranteed to be correct for the client
  const shareUrl = typeof window !== "undefined" ? window.location.href : `https://mvba.app/property/${propertyId}`;
  
  const shareTitle = `Stay at ${propertyName} | Bretania`;
  const shareText = `Check out this amazing stay in Bretania! ${propertyName}. Book your trip today.`;

  const handleShareClick = async () => {
    // 1. Try Native Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast.success("Thanks for sharing!");
      } catch (err: any) {
        // If the user aborts, don't show the fallback modal
        if (err.name !== "AbortError") {
          setIsModalOpen(true);
        }
      }
    } else {
      // 2. Fallback to custom Modal
      setIsModalOpen(true);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard!");
  };

  const openPopup = (url: string) => {
    window.open(url, "share-dialog", "width=600,height=500,toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1,left=0,top=0");
    setIsModalOpen(false);
  };

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`,
  };

  return (
    <>
      <button 
        onClick={handleShareClick}
        className="p-2 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-neutral-200 text-neutral-800 hover:bg-white hover:scale-105 transition-all"
        aria-label="Share property"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {/* Fallback Share Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-sm rounded-2xl bg-white border border-neutral-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 p-4 bg-neutral-50/50">
              <h3 className="font-bold text-base text-neutral-900 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-neutral-500" />
                Share this stay
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-full text-neutral-500 hover:bg-neutral-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Social Quick Links */}
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => openPopup(shareLinks.facebook)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-neutral-600 hover:text-blue-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                  <span className="text-[10px] font-semibold">Facebook</span>
                </button>
                <button 
                  onClick={() => openPopup(shareLinks.twitter)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-black hover:bg-neutral-100 transition-all text-neutral-600 hover:text-black"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
                  <span className="text-[10px] font-semibold">X</span>
                </button>
                <button 
                  onClick={() => openPopup(shareLinks.whatsapp)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-green-500 hover:bg-green-50 transition-all text-neutral-600 hover:text-green-600"
                >
                  <MessageCircle className="h-6 w-6" />
                  <span className="text-[10px] font-semibold">WhatsApp</span>
                </button>
                <button 
                  onClick={() => window.location.href = shareLinks.email}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-neutral-100 hover:border-neutral-400 hover:bg-neutral-100 transition-all text-neutral-600 hover:text-neutral-800"
                >
                  <Mail className="h-6 w-6" />
                  <span className="text-[10px] font-semibold">Email</span>
                </button>
              </div>

              {/* Copy Link Input */}
              <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                <label className="text-xs font-semibold text-neutral-800">Copy Link</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={shareUrl}
                    className="flex-1 h-10 px-3 text-xs bg-neutral-100 rounded-lg border border-neutral-200 text-neutral-600 focus:outline-none"
                  />
                  <Button onClick={handleCopyLink} className="h-10 px-4 bg-black text-white hover:bg-neutral-800 rounded-lg text-xs font-bold">
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
