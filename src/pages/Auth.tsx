import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRateLimiter } from '@/hooks/useRateLimiter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Leaf, Shield, Zap, Loader2, AlertTriangle, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { ZenLoader } from '@/components/zen';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'Password deve ter pelo menos 6 caracteres');

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { checkRateLimit, recordFailedAttempt, recordSuccess, getRemainingAttempts, remainingTime, maxAttempts } = useRateLimiter();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupName, setSignupName] = useState('');

  // Password recovery state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [defaultTab, setDefaultTab] = useState<'login' | 'signup'>('login');

  // Rate limit countdown
  const [countdown, setCountdown] = useState(0);

  // Check for reset mode or tab from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
      setIsResetMode(true);
    }
    if (params.get('tab') === 'signup') {
      setDefaultTab('signup');
    }
  }, []);

  useEffect(() => {
    if (user && !isResetMode) {
      navigate('/dashboard');
    }
  }, [user, navigate, isResetMode]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limit before attempting
    const rateLimitKey = `login_${loginEmail.toLowerCase()}`;
    const { allowed, waitTime } = checkRateLimit(rateLimitKey);
    
    if (!allowed) {
      setCountdown(waitTime);
      toast.error(`Demasiadas tentativas. Aguarde ${waitTime} segundos.`);
      return;
    }

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (error) {
      // Record failed attempt
      const { locked, lockDuration } = recordFailedAttempt(rateLimitKey);
      const remaining = getRemainingAttempts(rateLimitKey);
      
      if (locked) {
        setCountdown(lockDuration);
        toast.error(`Conta temporariamente bloqueada. Aguarde ${lockDuration} segundos.`);
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error(`Email ou password incorrectos. ${remaining} tentativas restantes.`);
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
      }
    } else {
      recordSuccess(rateLimitKey);
      toast.success('Login efectuado com sucesso!');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check rate limit for signup
    const rateLimitKey = `signup_${signupEmail.toLowerCase()}`;
    const { allowed, waitTime } = checkRateLimit(rateLimitKey);
    
    if (!allowed) {
      setCountdown(waitTime);
      toast.error(`Demasiadas tentativas. Aguarde ${waitTime} segundos.`);
      return;
    }

    if (!signupName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (signupPassword !== signupPasswordConfirm) {
      toast.error('As passwords não coincidem');
      return;
    }

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsSubmitting(false);

    if (error) {
      // Record failed attempt for signup too
      const { locked, lockDuration } = recordFailedAttempt(rateLimitKey);
      
      if (locked) {
        setCountdown(lockDuration);
        toast.error(`Demasiadas tentativas. Aguarde ${lockDuration} segundos.`);
      } else if (error.message.includes('already registered')) {
        toast.error('Este email já está registado');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } else {
      recordSuccess(rateLimitKey);
      toast.success('Conta criada com sucesso!');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setIsGoogleLoading(false);
    
    if (error) {
      toast.error('Erro ao entrar com Google. Tente novamente.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(forgotEmail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(forgotEmail);
    setIsSubmitting(false);

    if (error) {
      toast.error('Erro ao enviar email de recuperação. Tente novamente.');
    } else {
      setResetSent(true);
      toast.success('Email de recuperação enviado! Verifique a sua caixa de entrada.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== newPasswordConfirm) {
      toast.error('As passwords não coincidem');
      return;
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(newPassword);
    setIsSubmitting(false);

    if (error) {
      toast.error('Erro ao actualizar password. Tente novamente.');
    } else {
      toast.success('Password actualizada com sucesso!');
      setIsResetMode(false);
      navigate('/auth');
    }
  };

  const isRateLimited = countdown > 0;

  if (loading) {
    return <ZenLoader fullScreen text="A carregar..." />;
  }

  // Reset password mode - user clicked reset link in email
  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-sm animate-scale-in overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
            
            <CardHeader className="space-y-1 pb-4 text-center">
              <div className="mx-auto mb-4 p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl w-fit">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Nova Password</CardTitle>
              <CardDescription>
                Introduza a sua nova password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">Nova Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                  />
                  <PasswordStrengthIndicator password={newPassword} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password-confirm" className="text-sm font-medium">Confirmar Password</Label>
                  <Input
                    id="new-password-confirm"
                    type="password"
                    placeholder="••••••••"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                    className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                <Button
                  type="submit" 
                  className="w-full zen-button shadow-lg hover:shadow-xl transition-all duration-300 gap-2" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A actualizar...
                    </>
                  ) : (
                    'Actualizar Password'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding with Zen Style */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        
        {/* Zen decorative circles */}
        <div className="absolute top-20 -left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
        
        {/* Floating leaves decoration */}
        <div className="absolute top-32 right-20 opacity-20 animate-zen-float">
          <Leaf className="h-16 w-16 text-white" />
        </div>
        <div className="absolute bottom-40 left-20 opacity-10 animate-zen-float-delayed">
          <Leaf className="h-24 w-24 text-white" />
        </div>

        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Leaf className="h-8 w-8" />
              </div>
              IVAzen
            </h1>
            <p className="text-white/80 mt-3 text-lg">Gestão IVA Sem Stress</p>
          </div>

          <div className="space-y-8">
            {[
              {
                icon: Zap,
                title: 'Classificação Automática',
                description: 'IA que classifica facturas em segundos com 90%+ de precisão',
                delay: '100ms',
              },
              {
                icon: Shield,
                title: 'Conformidade Fiscal',
                description: 'Mapeamento automático para campos 20-24 da Declaração Periódica',
                delay: '200ms',
              },
              {
                icon: Leaf,
                title: 'Tranquilidade Total',
                description: 'Gestão de IVA sem stress, para você focar no que importa',
                delay: '300ms',
              },
            ].map((feature, index) => (
              <div 
                key={feature.title}
                className="flex items-start gap-4 animate-slide-up group"
                style={{ animationDelay: feature.delay }}
              >
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm group-hover:bg-white/20 transition-colors duration-300">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{feature.title}</h3>
                  <p className="text-white/70 text-sm mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-white/50 text-sm animate-fade-in" style={{ animationDelay: '400ms' }}>
            IVAzen © 2025 - Gestão IVA Sem Stress
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Forms with Zen Style */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
        {/* Subtle zen decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-primary/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile header */}
          <div className="lg:hidden mb-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                <Leaf className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">IVAzen</h1>
            </div>
            <p className="text-muted-foreground">Gestão IVA Sem Stress</p>
          </div>

          <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-sm animate-scale-in overflow-hidden">
            {/* Zen line decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
            
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Bem-vindo</CardTitle>
              <CardDescription>
                Entre na sua conta ou crie uma nova para começar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
                  <TabsTrigger value="login" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                    Criar Conta
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="animate-fade-in">
                  <form onSubmit={handleLogin} className="space-y-4">
                    {isRateLimited && (
                      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Demasiadas tentativas falhadas. Aguarde {countdown} segundos.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        disabled={isRateLimited}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          Esqueci a password
                        </button>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        disabled={isRateLimited}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                      />
                    </div>
                    <Button
                      type="submit" 
                      className="w-full zen-button shadow-lg hover:shadow-xl transition-all duration-300 gap-2" 
                      disabled={isSubmitting || isRateLimited}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          A entrar...
                        </>
                      ) : isRateLimited ? (
                        `Aguarde ${countdown}s`
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                    
                    {/* Google login temporariamente desactivado - aguardando configuração OAuth */}
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="animate-fade-in">
                  <form onSubmit={handleSignup} className="space-y-4">
                    {isRateLimited && (
                      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Demasiadas tentativas. Aguarde {countdown} segundos.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium">Nome Completo</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="O seu nome"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                        disabled={isRateLimited}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        disabled={isRateLimited}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        disabled={isRateLimited}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                      />
                      <PasswordStrengthIndicator password={signupPassword} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password-confirm" className="text-sm font-medium">Confirmar Password</Label>
                      <Input
                        id="signup-password-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={signupPasswordConfirm}
                        onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                        required
                        disabled={isRateLimited}
                        className="bg-background/50 border-border/50 hover:border-primary/50 focus:border-primary transition-colors"
                      />
                      {signupPasswordConfirm && signupPassword !== signupPasswordConfirm && (
                        <p className="text-xs text-destructive">As passwords não coincidem</p>
                      )}
                    </div>
                    <Button
                      type="submit" 
                      className="w-full zen-button shadow-lg hover:shadow-xl transition-all duration-300 gap-2" 
                      disabled={isSubmitting || isRateLimited}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          A criar conta...
                        </>
                      ) : isRateLimited ? (
                        `Aguarde ${countdown}s`
                      ) : (
                        'Criar Conta'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Trust badge */}
          <p className="text-center text-xs text-muted-foreground mt-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
            Os seus dados estão protegidos com encriptação de ponta a ponta
          </p>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Recuperar Password
            </DialogTitle>
            <DialogDescription>
              Introduza o seu email para receber instruções de recuperação
            </DialogDescription>
          </DialogHeader>
          
          {resetSent ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">Email enviado!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifique a sua caixa de entrada e siga as instruções para redefinir a sua password.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setForgotEmail('');
                }}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 zen-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Enviar Email'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
