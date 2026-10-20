import VoiceDiagnosticAssistant from "@/components/voice-diagnostic-assistant";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

export default function VoiceDiagnostic() {
  return (
    <AppShell filAriane={[{ libelle: "Diagnostic" }, { libelle: "Diagnostic vocal" }]} largeur="large">
    <div className="space-y-6">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-ink mb-4">
            Maintrix - Assistant Vocal
          </h1>
          <p className="text-xl text-ink-soft max-w-3xl mx-auto">
            Diagnostic intelligent avec reconnaissance vocale et IA avancée
          </p>
          <div className="mt-6 flex justify-center">
            <div className="bg-white rounded-full px-6 py-2 border border-etat-encours-filet">
              <span className="text-etat-encours-texte font-medium">
                Décrivez le problème à voix haute pour un diagnostic instantané
              </span>
            </div>
          </div>
        </div>

        {/* Voice Diagnostic Interface */}
        <VoiceDiagnosticAssistant />
      </div>
    </div>
    </AppShell>
  );
}