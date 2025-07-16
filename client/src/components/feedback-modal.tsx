import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
  diagnosis: string;
  solution: string;
}

export function FeedbackModal({ isOpen, onClose, sessionId, diagnosis, solution }: FeedbackModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<number>(0);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comments, setComments] = useState("");
  const [suggestionsAccuracy, setSuggestionsAccuracy] = useState<string>("");

  const feedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const response = await apiRequest("POST", "/api/feedback", feedbackData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback envoyé",
        description: "Merci ! Votre retour aide à améliorer notre système IA.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/learning-metrics"] });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le feedback",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRating(0);
    setHelpful(null);
    setComments("");
    setSuggestionsAccuracy("");
  };

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Évaluation requise",
        description: "Veuillez donner une note de 1 à 5 étoiles",
        variant: "destructive",
      });
      return;
    }

    const feedbackData = {
      sessionId,
      rating,
      helpful,
      comments,
      suggestionsAccuracy,
      timestamp: new Date().toISOString()
    };

    feedbackMutation.mutate(feedbackData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span>Évaluation du Diagnostic</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Diagnostic Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Diagnostic fourni:</h3>
            <p className="text-sm text-blue-800 mb-2">{diagnosis}</p>
            <p className="text-sm text-blue-700">{solution}</p>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Évaluation globale *</Label>
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-1 transition-colors ${
                    rating >= star ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"
                  }`}
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-600">
                {rating > 0 && `${rating}/5`}
              </span>
            </div>
          </div>

          {/* Helpful Yes/No */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ce diagnostic vous a-t-il été utile ?</Label>
            <div className="flex space-x-3">
              <Button
                variant={helpful === true ? "default" : "outline"}
                onClick={() => setHelpful(true)}
                className={`flex items-center space-x-2 ${
                  helpful === true ? "bg-green-600 text-white" : "hover:bg-green-50 hover:border-green-300"
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Oui</span>
              </Button>
              <Button
                variant={helpful === false ? "default" : "outline"}
                onClick={() => setHelpful(false)}
                className={`flex items-center space-x-2 ${
                  helpful === false ? "bg-red-600 text-white" : "hover:bg-red-50 hover:border-red-300"
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                <span>Non</span>
              </Button>
            </div>
          </div>

          {/* Suggestions Accuracy */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Précision des suggestions</Label>
            <div className="flex flex-wrap gap-2">
              {[
                "Très précise",
                "Assez précise", 
                "Partiellement correcte",
                "Imprécise",
                "Hors sujet"
              ].map((option) => (
                <Button
                  key={option}
                  variant={suggestionsAccuracy === option ? "default" : "outline"}
                  onClick={() => setSuggestionsAccuracy(option)}
                  size="sm"
                  className="text-xs"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Commentaires et suggestions d'amélioration</Label>
            <Textarea
              placeholder="Décrivez votre expérience, suggérez des améliorations, ou signalez des problèmes..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-gray-500">
              Vos commentaires nous aident à améliorer l'IA de diagnostic
            </p>
          </div>

          {/* Rating Summary */}
          {rating > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-600">Votre évaluation:</span>
                <Badge variant={rating >= 4 ? "default" : rating >= 3 ? "secondary" : "destructive"}>
                  {rating >= 4 ? "Excellent" : rating >= 3 ? "Satisfaisant" : "À améliorer"}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={feedbackMutation.isPending || rating === 0}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          >
            {feedbackMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Envoi...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Envoyer le feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}