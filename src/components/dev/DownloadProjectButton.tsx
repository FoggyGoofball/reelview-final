'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DownloadProjectButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    setIsLoading(true);
    toast({
      title: 'Preparing Download...',
      description: 'The project is being zipped on the server. Your download will start shortly.',
    });

    // The download is triggered by navigating to the API route.
    // The browser will handle the "Save As" dialog.
    window.location.href = '/api/download-project';

    // We can't know exactly when the download starts, so we'll just reset
    // the button after a reasonable timeout.
    setTimeout(() => {
        setIsLoading(false);
    }, 5000); // 5 seconds
  };

  return (
    <div className="flex flex-col items-start gap-2">
       <h4 className="font-semibold">Download Source Code</h4>
        <p className="text-sm text-muted-foreground">
          Download the complete source code for this project as a zip file.
        </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button disabled={isLoading} variant="outline">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download Project
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Download Project Source?</AlertDialogTitle>
                <AlertDialogDescription>
                This will package the entire project repository (excluding node_modules and build artifacts) into a zip file for you to download.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDownload}>Confirm & Download</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
