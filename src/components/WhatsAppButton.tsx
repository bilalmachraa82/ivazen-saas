import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

const WhatsAppButton = () => {
    const [isVisible, setIsVisible] = useState(false);
    const phoneNumber = "351910542488";
    const defaultMessage = "Olá! Gostaria de saber mais sobre o IVAzen.";

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
        defaultMessage
    )}`;

    useEffect(() => {
        // Show after a short delay so it doesn't distract immediately on load
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 animate-in zoom-in slide-in-from-bottom-5 duration-500 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30 transition-transform hover:scale-110 hover:shadow-xl hover:shadow-[#25D366]/40 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 dark:focus:ring-offset-background"
            aria-label="Fale connosco no WhatsApp"
            title="Fale connosco no WhatsApp"
        >
            <MessageCircle className="h-7 w-7" />
            {/* Pulse effect ring */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-30"></span>
        </a>
    );
};

export default WhatsAppButton;
