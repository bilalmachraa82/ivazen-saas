import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { validatePortugueseNIF } from '@/lib/nifValidator';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export interface NifInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation?: (isValid: boolean, message?: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  allowForeign?: boolean; // permite NIFs estrangeiros (5+ digitos)
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  showValidationIcon?: boolean;
  validateOnChange?: boolean; // validar enquanto digita (default: false)
}

export interface NifValidationResult {
  valid: boolean;
  error?: string;
  type?: 'portuguese' | 'foreign';
}

/**
 * Valida NIF portugues ou estrangeiro
 */
export function validateNIF(
  nif: string,
  options: { allowForeign?: boolean; required?: boolean } = {}
): NifValidationResult {
  const { allowForeign = false, required = false } = options;
  const cleanNIF = nif.replace(/\s/g, '');

  // Campo vazio
  if (!cleanNIF) {
    if (required) {
      return { valid: false, error: 'NIF e obrigatorio' };
    }
    return { valid: true };
  }

  // Verificar se contem apenas numeros
  if (!/^\d+$/.test(cleanNIF)) {
    return { valid: false, error: 'NIF deve conter apenas numeros' };
  }

  // NIF portugues (9 digitos)
  if (cleanNIF.length === 9) {
    const result = validatePortugueseNIF(cleanNIF);
    return {
      valid: result.valid,
      error: result.error,
      type: 'portuguese',
    };
  }

  // NIF estrangeiro (5+ digitos, se permitido)
  if (allowForeign && cleanNIF.length >= 5) {
    return {
      valid: true,
      type: 'foreign',
    };
  }

  // NIF em progresso (menos de 9 digitos)
  if (cleanNIF.length < 9) {
    return {
      valid: false,
      error: `NIF deve ter 9 digitos (faltam ${9 - cleanNIF.length})`
    };
  }

  // Mais de 9 digitos
  return {
    valid: false,
    error: 'NIF portugues deve ter exactamente 9 digitos'
  };
}

/**
 * Componente NifInput - Input especializado para NIF portugues
 *
 * Caracteristicas:
 * - Mascara automatica (so aceita numeros)
 * - Validacao em tempo real do digito de controlo
 * - Icone de status (check verde / X vermelho)
 * - Mensagem de erro inline
 * - Suporte a NIF estrangeiro (opcional)
 */
export function NifInput({
  value,
  onChange,
  onValidation,
  label = 'NIF',
  required = false,
  disabled = false,
  allowForeign = false,
  placeholder = '123456789',
  className,
  id,
  name,
  showValidationIcon = true,
  validateOnChange = false,
}: NifInputProps) {
  const [validation, setValidation] = useState<NifValidationResult | null>(null);
  const [touched, setTouched] = useState(false);

  // Validar valor
  const performValidation = useCallback((nifValue: string) => {
    const result = validateNIF(nifValue, { allowForeign, required });
    setValidation(result);
    onValidation?.(result.valid, result.error);
    return result;
  }, [allowForeign, required, onValidation]);

  // Validar quando valor muda (se validateOnChange)
  useEffect(() => {
    if (validateOnChange && value) {
      performValidation(value);
    }
  }, [value, validateOnChange, performValidation]);

  // Handler para mudanca de valor
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remover caracteres nao numericos
    const cleanValue = e.target.value.replace(/\D/g, '');

    // Limitar a 9 digitos (ou mais se allowForeign)
    const maxLength = allowForeign ? 15 : 9;
    const limitedValue = cleanValue.slice(0, maxLength);

    onChange(limitedValue);

    // Validar em tempo real se configurado
    if (validateOnChange) {
      performValidation(limitedValue);
    } else {
      // Limpar validacao se ainda a digitar
      if (limitedValue.length < 9 && validation) {
        setValidation(null);
      }
    }
  };

  // Handler para blur
  const handleBlur = () => {
    setTouched(true);
    performValidation(value);
  };

  // Determinar estado visual
  const showError = touched && validation && !validation.valid && value.length > 0;
  const showSuccess = validation?.valid && value.length >= 9;
  const showForeignIndicator = validation?.type === 'foreign';

  // Determinar icone
  const getStatusIcon = () => {
    if (!showValidationIcon || !value || value.length < 5) return null;

    if (showSuccess) {
      return (
        <CheckCircle
          className="h-4 w-4 text-green-500"
          aria-label="NIF valido"
        />
      );
    }

    if (showError) {
      return (
        <XCircle
          className="h-4 w-4 text-destructive"
          aria-label="NIF invalido"
        />
      );
    }

    if (value.length === 9 && !touched) {
      // Validar rapidamente para mostrar icone
      const quickResult = validateNIF(value, { allowForeign, required });
      if (quickResult.valid) {
        return (
          <CheckCircle
            className="h-4 w-4 text-green-500"
            aria-label="NIF valido"
          />
        );
      }
      return (
        <AlertCircle
          className="h-4 w-4 text-amber-500"
          aria-label="Verifique o NIF"
        />
      );
    }

    return null;
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label
          htmlFor={id || 'nif-input'}
          className="text-sm font-medium"
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          id={id || 'nif-input'}
          name={name}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={allowForeign ? 15 : 9}
          disabled={disabled}
          aria-invalid={showError ? 'true' : undefined}
          aria-describedby={showError ? `${id || 'nif'}-error` : undefined}
          className={cn(
            'font-mono pr-10',
            'bg-background/50 border-border/50',
            'hover:border-primary/50 focus:border-primary transition-colors',
            showSuccess && 'border-green-500 focus:border-green-500',
            showError && 'border-destructive focus:border-destructive',
            className
          )}
        />

        {showValidationIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {getStatusIcon()}
          </div>
        )}
      </div>

      {/* Mensagem de estado */}
      {showError && validation?.error && (
        <p
          id={`${id || 'nif'}-error`}
          className="text-xs text-destructive flex items-center gap-1"
          role="alert"
        >
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {validation.error}
        </p>
      )}

      {showSuccess && showForeignIndicator && (
        <p className="text-xs text-muted-foreground">
          NIF estrangeiro detectado
        </p>
      )}

      {showSuccess && !showForeignIndicator && (
        <p className="text-xs text-green-600 dark:text-green-400">
          NIF portugues valido
        </p>
      )}
    </div>
  );
}

/**
 * Hook para usar validacao de NIF em formularios
 */
export function useNifValidation(initialValue: string = '', options: { allowForeign?: boolean; required?: boolean } = {}) {
  const [value, setValue] = useState(initialValue);
  const [validation, setValidation] = useState<NifValidationResult | null>(null);
  const [touched, setTouched] = useState(false);

  const validate = useCallback(() => {
    const result = validateNIF(value, options);
    setValidation(result);
    return result;
  }, [value, options]);

  const handleChange = useCallback((newValue: string) => {
    const cleanValue = newValue.replace(/\D/g, '').slice(0, options.allowForeign ? 15 : 9);
    setValue(cleanValue);
  }, [options.allowForeign]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    validate();
  }, [validate]);

  const reset = useCallback(() => {
    setValue('');
    setValidation(null);
    setTouched(false);
  }, []);

  return {
    value,
    setValue: handleChange,
    validation,
    touched,
    setTouched,
    validate,
    handleBlur,
    reset,
    isValid: validation?.valid ?? false,
    error: validation?.error,
  };
}

export default NifInput;
