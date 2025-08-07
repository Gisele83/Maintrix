import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Brain, 
  Activity,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2
} from "lucide-react";

interface DiagnosticSession {
  id: string;
  timestamp: Date;
  userQuery: string;
  aiResponse: string;
  confidence: number;
  recommendations: string[];
  equipmentId?: number;
  status: 'analyzing' | 'completed' | 'error';
}

interface VoiceRecognition {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  confidence: number;
}

export default function VoiceDiagnosticAssistant() {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        
        setCurrentTranscript(transcript);
        
        // If final result, process it
        if (event.results[event.results.length - 1].isFinal) {
          processDiagnosticQuery(transcript);
        }
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast({
          title: "Erreur de reconnaissance vocale",
          description: "Impossible de reconnaître la voix. Vérifiez votre microphone.",
          variant: "destructive",
        });
      };
    }
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setCurrentTranscript("");
      setIsListening(true);
      recognitionRef.current.start();
      
      toast({
        title: "Assistant vocal activé",
        description: "Décrivez le problème ou symptôme...",
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakResponse = (text: string) => {
    if (synthesisRef.current && voiceEnabled) {
      // Stop any current speech
      synthesisRef.current.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthesisRef.current.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const processDiagnosticQuery = async (query: string) => {
    if (!query.trim()) return;
    
    setIsProcessing(true);
    const sessionId = `session_${Date.now()}`;
    
    // Create new session
    const newSession: DiagnosticSession = {
      id: sessionId,
      timestamp: new Date(),
      userQuery: query,
      aiResponse: "",
      confidence: 0,
      recommendations: [],
      status: 'analyzing'
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentTranscript("");
    
    try {
      // Call AI diagnostic API
      const response = await apiRequest("POST", "/api/voice-diagnostic", {
        query: query,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      });
      
      const diagnosticResult = response;
      
      // Update session with results
      const updatedSession: DiagnosticSession = {
        ...newSession,
        aiResponse: diagnosticResult.diagnosis,
        confidence: diagnosticResult.confidence,
        recommendations: diagnosticResult.recommendations || [],
        equipmentId: diagnosticResult.equipmentId,
        status: 'completed'
      };
      
      setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));
      
      // Speak the response
      const spokenResponse = `Diagnostic effectué avec ${Math.round(diagnosticResult.confidence * 100)}% de confiance. ${diagnosticResult.diagnosis}`;
      speakResponse(spokenResponse);
      
      toast({
        title: "Diagnostic terminé",
        description: `Confiance: ${Math.round(diagnosticResult.confidence * 100)}%`,
      });
      
    } catch (error: any) {
      console.error('Erreur diagnostic vocal:', error);
      
      const errorSession: DiagnosticSession = {
        ...newSession,
        aiResponse: "Erreur lors du diagnostic. Veuillez réessayer.",
        status: 'error'
      };
      
      setSessions(prev => prev.map(s => s.id === sessionId ? errorSession : s));
      
      toast({
        title: "Erreur de diagnostic",
        description: "Impossible de traiter la demande. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'analyzing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-100";
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const isVoiceSupported = recognitionRef.current !== null;

  return (
    <div className="space-y-6">
      {/* Voice Control Panel */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-blue-600" />
            Assistant de Diagnostic Vocal
            <Badge variant="secondary" className="ml-auto">
              {isVoiceSupported ? "Actif" : "Non supporté"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isVoiceSupported ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <p className="text-gray-600">
                Votre navigateur ne supporte pas la reconnaissance vocale.
                Utilisez Chrome ou Edge pour cette fonctionnalité.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Voice Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  size="lg"
                  className={`${
                    isListening 
                      ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white px-8 py-4`}
                >
                  {isListening ? (
                    <><MicOff className="w-5 h-5 mr-2" /> Arrêter l'écoute</>
                  ) : (
                    <><Mic className="w-5 h-5 mr-2" /> Commencer le diagnostic</>
                  )}
                </Button>

                <Button
                  onClick={voiceEnabled ? stopSpeaking : () => setVoiceEnabled(true)}
                  variant="outline"
                  size="lg"
                  disabled={!isSpeaking && !voiceEnabled}
                >
                  {isSpeaking ? (
                    <><VolumeX className="w-5 h-5 mr-2" /> Arrêter la voix</>
                  ) : (
                    <><Volume2 className="w-5 h-5 mr-2" /> {voiceEnabled ? "Audio activé" : "Audio désactivé"}</>
                  )}
                </Button>
              </div>

              {/* Current Transcript */}
              {(isListening || currentTranscript) && (
                <div className="bg-white p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">
                      {isListening ? "En cours d'écoute..." : "Transcription:"}
                    </span>
                  </div>
                  <p className="text-gray-700">
                    {currentTranscript || "Parlez maintenant..."}
                  </p>
                </div>
              )}

              {/* Processing Indicator */}
              {isProcessing && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="text-blue-700 font-medium">Analyse du diagnostic en cours...</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnostic Sessions History */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Historique des Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(session.status)}
                        <span className="text-sm text-gray-500">
                          {session.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      {session.confidence > 0 && (
                        <Badge className={getConfidenceColor(session.confidence)}>
                          {Math.round(session.confidence * 100)}% confiance
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-1">Question:</h4>
                        <p className="text-gray-900 bg-gray-50 p-2 rounded">
                          {session.userQuery}
                        </p>
                      </div>

                      {session.aiResponse && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">Diagnostic:</h4>
                          <p className="text-gray-900 bg-blue-50 p-2 rounded">
                            {session.aiResponse}
                          </p>
                        </div>
                      )}

                      {session.recommendations.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-1">Recommandations:</h4>
                          <ul className="list-disc list-inside text-sm text-gray-700 bg-green-50 p-2 rounded">
                            {session.recommendations.map((rec, index) => (
                              <li key={index}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card className="border-gray-200 bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">Instructions d'utilisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Cliquez sur "Commencer le diagnostic" et décrivez le problème</p>
            <p>• Parlez clairement en français</p>
            <p>• Mentionnez l'équipement concerné et les symptômes observés</p>
            <p>• L'IA analysera votre description et fournira un diagnostic</p>
            <p>• Les recommandations seront lues à voix haute automatiquement</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}