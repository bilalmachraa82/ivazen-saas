import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search, Leaf } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-10 w-10 text-primary" />
          </div>
        </div>
        
        <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
        
        <p className="mb-2 text-xl font-medium text-foreground">
          Página não encontrada
        </p>
        
        <p className="mb-8 text-muted-foreground">
          A página que procura não existe ou foi movida.
        </p>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Página Inicial
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/dashboard">
              <Search className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
