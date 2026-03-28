import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "ivazen_cookie_consent";

const CookieBanner = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!consent) {
            // Small delay so it doesn't flash on page load
            const timer = setTimeout(() => setVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const acceptCookies = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
        setVisible(false);
    };

    const declineCookies = () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-30 animate-in slide-in-from-bottom-5 duration-500"
            role="dialog"
            aria-label="Consentimento de cookies"
        >
            <div className="mx-auto max-w-4xl p-4">
                <div className="glass-card rounded-2xl border border-primary/20 p-5 shadow-glow-lg backdrop-blur-xl">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Cookie className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                Utilizamos apenas cookies essenciais para o funcionamento da aplicação
                                (autenticação e preferências). Não utilizamos cookies de rastreamento
                                nem publicidade.{" "}
                                <Link
                                    to="/privacy"
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    Política de Privacidade
                                </Link>
                            </p>
                            <div className="mt-3 flex items-center gap-3">
                                <Button
                                    onClick={acceptCookies}
                                    size="sm"
                                    className="premium-button shadow-glow text-xs"
                                >
                                    Aceitar
                                </Button>
                                <Button
                                    onClick={declineCookies}
                                    variant="outline"
                                    size="sm"
                                    className="border-primary/30 text-xs hover:border-primary"
                                >
                                    Apenas essenciais
                                </Button>
                            </div>
                        </div>
                        <button
                            onClick={declineCookies}
                            className="flex-shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            aria-label="Fechar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieBanner;
