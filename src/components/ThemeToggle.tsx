import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch - must wait for client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use resolvedTheme to handle "system" theme properly
  const currentTheme = resolvedTheme || theme;
  const isDark = currentTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 relative"
      onClick={toggleTheme}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
    >
      <Sun className={`h-4 w-4 transition-all duration-300 ${isDark ? 'rotate-0 scale-100' : 'rotate-90 scale-0 absolute'}`} />
      <Moon className={`h-4 w-4 transition-all duration-300 ${isDark ? '-rotate-90 scale-0 absolute' : 'rotate-0 scale-100'}`} />
    </Button>
  );
}
