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
  const [actualSolution, setActualSolution] = useState("");

  const feedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      return await apiRequest("/api/feedback", { method: "POST", body: feedbackData });
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
    setActualSolution("");
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
      actualSolution: actualSolution || undefined,
      timestamp: new Date().toISOString()
    };

    feedbackMutation.mutate(feedbackData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-etat-encours-texte" />
            <span>Évaluation du Diagnostic</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Diagnostic Summary */}
          <div className="bg-paper-deep p-4 rounded-lg border border-etat-encours-filet">
            <h3 className="font-semibold text-etat-encours-texte mb-2">Diagnostic fourni:</h3>
            <p className="text-sm text-etat-encours-texte mb-2">{diagnosis}</p>
            <p className="text-sm text-etat-encours-texte">{solution}</p>
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
                    rating >= star ? "text-etat-alerte-texte" : "text-ink-mute hover:text-etat-alerte-texte"
                  }`}
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>
              ))}
              <span className="ml-2 text-sm text-ink-soft">
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
                  helpful === true ? "bg-etat-nominal-vif text-white" : "hover:bg-etat-nominal-fond hover:border-etat-nominal-filet"
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Oui</span>
              </Button>
              <Button
                variant={helpful === false ? "default" : "outline"}
                onClick={() => setHelpful(false)}
                className={`flex items-center space-x-2 ${
                  helpful === false ? "bg-etat-critique-vif text-white" : "hover:bg-etat-critique-fond hover:border-etat-critique-filet"
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

          {/* Actual Solution - shown when diagnostic was not helpful */}
          {helpful === false && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quelle était la vraie solution ?</Label>
              <Textarea
                placeholder="Décrivez la solution qui a réellement résolu le problème..."
                value={actualSolution}
                onChange={(e) => setActualSolution(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-etat-alerte-texte">
                Cette information enrichit automatiquement la base de connaissances
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Commentaires et suggestions d'amélioration</Label>
            <Textarea
              placeholder="Décrivez votre expérience, suggérez des améliorations, ou signalez des problèmes..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-ink-mute">
              Vos commentaires nous aident à améliorer l'IA de diagnostic
            </p>
          </div>

          {/* Rating Summary */}
          {rating > 0 && (
            <div className="bg-paper p-3 rounded-lg">
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-ink-soft">Votre évaluation:</span>
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
            className="bg-paper-deep"
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