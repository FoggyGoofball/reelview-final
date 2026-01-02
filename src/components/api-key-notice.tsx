'use client';

import { useState } from 'react';
import { AlertTriangle, KeyRound, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useApiKeyDialog } from '@/context/api-key-dialog-context';
import { useNavigate } from 'react-router-dom';

export function ApiKeyNotice() {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [showChangeKey, setShowChangeKey] = useState(false);
  const { toast } = useToast();
  const { showDialog, closeDialog } = useApiKeyDialog();
  const navigate = useNavigate();

  // Check if API key is already saved
  const savedKey = typeof window !== 'undefined' ? localStorage.getItem('TMDB_API_KEY') : null;

  // Only render if dialog is open or no key is set
  if (!showDialog && savedKey && !showChangeKey) return null;

  const validateApiKey = async (key: string): Promise<boolean> => {
    if (!key.trim()) {
      setValidationStatus('invalid');
      return false;
    }

    setIsValidating(true);
    setValidationStatus('idle');

    try {
      // Test the API key with a simple request
      const response = await fetch(
        `https://api.themoviedb.org/3/configuration?api_key=${key}`
      );

      if (response.ok) {
        setValidationStatus('valid');
        setIsValidating(false);
        return true;
      } else if (response.status === 401) {
        setValidationStatus('invalid');
        setIsValidating(false);
        return false;
      } else {
        setValidationStatus('invalid');
        setIsValidating(false);
        return false;
      }
    } catch (error) {
      console.error('Error validating API key:', error);
      setValidationStatus('invalid');
      setIsValidating(false);
      return false;
    }
  };

  const handleValidate = async () => {
    const isValid = await validateApiKey(apiKey);
    if (isValid) {
      toast({
        title: 'API Key Valid!',
        description: 'This key works. Click "Save Key" to continue.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid API Key',
        description: 'The key you entered is not valid. Please check it and try again.',
      });
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        variant: 'destructive',
        title: 'API Key is required',
        description: 'Please enter a valid TMDB API key.',
      });
      return;
    }

    // Validate before saving
    setIsValidating(true);
    const isValid = await validateApiKey(apiKey);

    if (!isValid) {
      toast({
        variant: 'destructive',
        title: 'Invalid API Key',
        description: 'Please enter a valid TMDB API key. You can test it first by clicking "Validate".',
      });
      return;
    }

    localStorage.setItem('TMDB_API_KEY', apiKey);
    // Dispatch an event so other parts of the app can react without a full reload
    try {
      window.dispatchEvent(new CustomEvent('tmdb-api-key-changed'));
    } catch (e) {
      console.warn('Could not dispatch api key event', e);
    }

    toast({
      title: 'API Key Saved!',
      description: 'The dialog will close and the app will refresh data.',
    });

    // Close dialog and navigate to home to avoid blank page
    closeDialog();
    try {
      navigate('/');
    } catch (e) {
      /* ignore */
    }
  };

  const handleChangeKey = () => {
    setApiKey('');
    setValidationStatus('idle');
    setShowChangeKey(true);
    localStorage.removeItem('TMDB_API_KEY');
  };

  // Modal wrapper to overlay on top of the UI
  const ModalWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={closeDialog} />
      <div className="relative z-50 w-full max-w-md p-6 mx-4 sm:mx-0">
        {children}
      </div>
    </div>
  );

  // If a valid key is already saved, show option to change it
  if (savedKey && !showChangeKey) {
    return (
      <ModalWrapper>
        <div className="p-6 rounded-lg bg-green-950/30 border border-green-700/50 flex flex-col items-center text-center">
          <Check className="w-12 h-12 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">API Key Configured</h2>
          <p className="text-muted-foreground mb-6">
            A TMDB API key is already set up and ready to use.
          </p>

          <div className="flex gap-4">
            <Button 
              onClick={() => { closeDialog(); navigate('/'); }}
            >
              Continue to App
            </Button>
            <Button 
              variant="outline" 
              onClick={handleChangeKey}
            >
              Change API Key
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/50 mt-6">
            API key: {savedKey.substring(0, 6)}...{savedKey.substring(savedKey.length - 4)}
          </p>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      <div className="p-6 rounded-lg bg-secondary border border-primary/20 flex flex-col items-center text-center">
        <button onClick={closeDialog} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <AlertTriangle className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">TMDB API Key Required</h2>
        <p className="text-muted-foreground mb-6">
          This app requires a The Movie Database (TMDB) API key to fetch movie data. Please get a free key, paste it below, and click save.
        </p>

        <div className="w-full max-w-sm space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setValidationStatus('idle');
              }}
              placeholder="Enter your TMDB API Key..."
              className="pl-9 pr-10"
              aria-label="TMDB API Key"
            />
            {validationStatus === 'valid' && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
            {validationStatus === 'invalid' && (
              <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
            )}
          </div>

          {/* Validation status message */}
          {validationStatus === 'valid' && (
            <p className="text-sm text-green-500 flex items-center gap-2">
              <Check className="h-4 w-4" /> API key is valid
            </p>
          )}
          {validationStatus === 'invalid' && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <X className="h-4 w-4" /> API key is invalid
            </p>
          )}

          <div className="flex gap-2 justify-center flex-wrap">
            <Button 
              onClick={handleValidate} 
              disabled={!apiKey.trim() || isValidating}
              variant="outline"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...
                </>
              ) : (
                'Validate'
              )}
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!apiKey.trim() || validationStatus === 'invalid' || isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking...
                </>
              ) : (
                'Save Key'
              )}
            </Button>
            <Button asChild variant="outline">
              <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer">
                Get Key
              </a>
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50 mt-6">
          Your API key will be stored in your browser's local storage.
        </p>
      </div>
    </ModalWrapper>
  );
}
