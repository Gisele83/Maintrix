import VoiceDiagnosticAssistant from "@/components/voice-diagnostic-assistant";

export default function VoiceDiagnostic() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Maintrix - Assistant Vocal
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Diagnostic intelligent avec reconnaissance vocale et IA avancée
          </p>
          <div className="mt-6 flex justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-full px-6 py-2 border border-blue-200">
              <span className="text-blue-600 font-medium">
                Décrivez le problème à voix haute pour un diagnostic instantané
              </span>
            </div>
          </div>
        </div>

        {/* Voice Diagnostic Interface */}
        <VoiceDiagnosticAssistant />
      </div>
    </div>
  );
}