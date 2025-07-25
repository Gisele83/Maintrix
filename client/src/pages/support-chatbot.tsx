import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  User, 
  Send, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  HelpCircle,
  Wrench,
  Bug,
  Lightbulb,
  RefreshCw,
  Copy,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  category?: 'diagnostic' | 'gmao' | 'security' | 'payment' | 'general';
  helpful?: boolean;
}

interface BugSolution {
  id: string;
  title: string;
  category: string;
  description: string;
  steps: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export default function SupportChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: "Bonjour ! Je suis l'assistant technique de Smart GMAO DiagFix. Comment puis-je vous aider aujourd'hui ? Je peux vous assister avec :\n\n• Problèmes de diagnostic IA\n• Difficultés GMAO\n• Questions de sécurité\n• Problèmes de paiement\n• Erreurs techniques diverses",
      timestamp: new Date(),
      category: 'general'
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const commonBugSolutions: BugSolution[] = [
    {
      id: '1',
      title: "Diagnostic IA ne fonctionne pas",
      category: "diagnostic",
      description: "L'IA de diagnostic ne retourne pas de résultats ou affiche des erreurs",
      steps: [
        "Vérifiez que tous les champs obligatoires sont remplis",
        "Assurez-vous que l'équipement est sélectionné dans la liste",
        "Vérifiez votre connexion internet",
        "Essayez de recharger la page (Ctrl+F5)",
        "Si le problème persiste, utilisez le mode ML de base au lieu du mode avancé"
      ],
      severity: 'medium'
    },
    {
      id: '2',
      title: "Erreur de connexion au tableau de bord",
      category: "gmao",
      description: "Impossible d'accéder au tableau de bord GMAO ou erreur 401",
      steps: [
        "Vérifiez vos identifiants de connexion",
        "Effacez le cache de votre navigateur",
        "Déconnectez-vous puis reconnectez-vous",
        "Vérifiez que votre session n'a pas expiré",
        "Contactez l'administrateur si vous n'avez pas les bonnes permissions"
      ],
      severity: 'high'
    },
    {
      id: '3',
      title: "Problème de paiement ou facturation",
      category: "payment",
      description: "Erreurs lors du processus de paiement ou problèmes de facturation",
      steps: [
        "Vérifiez les détails de votre carte bancaire",
        "Assurez-vous que votre compte a les fonds suffisants",
        "Vérifiez que votre plan d'essai n'a pas expiré",
        "Contactez votre banque si la transaction est refusée",
        "Utilisez un autre moyen de paiement si disponible"
      ],
      severity: 'medium'
    },
    {
      id: '4',
      title: "Données IoT non affichées",
      category: "gmao",
      description: "Les capteurs IoT n'affichent pas de données ou montrent des valeurs incorrectes",
      steps: [
        "Vérifiez la connexion des capteurs IoT",
        "Redémarrez le service de collecte de données",
        "Vérifiez les seuils configurés pour les alertes",
        "Synchronisez les données depuis le tableau de bord IoT",
        "Vérifiez que les capteurs sont bien associés aux équipements"
      ],
      severity: 'high'
    },
    {
      id: '5',
      title: "Export CSV/Excel échoue",
      category: "general",
      description: "Impossible d'exporter les données en format CSV ou Excel",
      steps: [
        "Vérifiez que vous avez sélectionné des données à exporter",
        "Essayez de réduire la plage de dates pour l'export",
        "Vérifiez l'espace disponible sur votre disque",
        "Désactivez temporairement votre antivirus",
        "Essayez avec un navigateur différent"
      ],
      severity: 'low'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const analyzeUserMessage = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    // Détection de mots-clés pour catégoriser le problème
    if (lowerMessage.includes('diagnostic') || lowerMessage.includes('ia') || lowerMessage.includes('ml')) {
      return 'diagnostic';
    } else if (lowerMessage.includes('gmao') || lowerMessage.includes('équipement') || lowerMessage.includes('maintenance')) {
      return 'gmao';
    } else if (lowerMessage.includes('paiement') || lowerMessage.includes('facture') || lowerMessage.includes('carte')) {
      return 'payment';
    } else if (lowerMessage.includes('sécurité') || lowerMessage.includes('connexion') || lowerMessage.includes('login')) {
      return 'security';
    }
    return 'general';
  };

  const generateBotResponse = (userMessage: string, category: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    // Recherche de solutions spécifiques
    const relevantSolutions = commonBugSolutions.filter(solution => 
      solution.category === category || 
      lowerMessage.includes(solution.title.toLowerCase().split(' ')[0])
    );

    if (relevantSolutions.length > 0) {
      const solution = relevantSolutions[0];
      return `Je vois que vous rencontrez un problème avec "${solution.title}". Voici les étapes de résolution recommandées :\n\n${solution.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\nCette solution devrait résoudre votre problème. Si ce n'est pas le cas, n'hésitez pas à me donner plus de détails !`;
    }

    // Réponses par catégorie
    switch (category) {
      case 'diagnostic':
        return "Pour les problèmes de diagnostic IA, voici quelques vérifications de base :\n\n• Assurez-vous que tous les champs sont remplis\n• Vérifiez votre connexion internet\n• Essayez de changer de mode ML (Standard/Avancé)\n• Rechargez la page si nécessaire\n\nPouvez-vous me décrire plus précisément le problème que vous rencontrez ?";
      
      case 'gmao':
        return "Pour les problèmes GMAO, voici les vérifications courantes :\n\n• Vérifiez vos permissions d'accès\n• Assurez-vous que vos données sont synchronisées\n• Vérifiez la connexion IoT si applicable\n• Redémarrez votre session si nécessaire\n\nQuel type d'erreur ou de dysfonctionnement observez-vous exactement ?";
      
      case 'payment':
        return "Pour les problèmes de paiement :\n\n• Vérifiez les détails de votre carte\n• Assurez-vous que votre essai gratuit n'a pas expiré\n• Vérifiez avec votre banque\n• Essayez un autre moyen de paiement\n\nQuel message d'erreur recevez-vous lors du paiement ?";
      
      case 'security':
        return "Pour les problèmes de sécurité et connexion :\n\n• Vérifiez vos identifiants\n• Effacez le cache de votre navigateur\n• Vérifiez que votre IP n'est pas bloquée\n• Contactez l'administrateur si nécessaire\n\nRencontrez-vous des erreurs 401, 403 ou d'autres codes d'erreur ?";
      
      default:
        return "Je comprends votre question. Pour mieux vous aider, pourriez-vous me donner plus de détails sur :\n\n• Le problème exact que vous rencontrez\n• Les messages d'erreur affichés\n• Les étapes que vous avez déjà essayées\n• Dans quelle partie de l'application cela se produit\n\nPlus vous me donnez d'informations, mieux je peux vous assister !";
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Simulation de réflexion du bot
    setTimeout(() => {
      const category = analyzeUserMessage(inputMessage);
      const botResponse = generateBotResponse(inputMessage, category);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: botResponse,
        timestamp: new Date(),
        category: category as any
      };

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = (messageId: string, helpful: boolean) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, helpful } : msg
    ));
    
    toast({
      title: helpful ? "Merci pour votre retour !" : "Retour enregistré",
      description: helpful ? "Cette réponse vous a été utile" : "Nous améliorerons nos réponses",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: "Le message a été copié dans le presse-papiers",
    });
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'diagnostic': return <Wrench className="h-4 w-4" />;
      case 'gmao': return <Bug className="h-4 w-4" />;
      case 'security': return <AlertCircle className="h-4 w-4" />;
      case 'payment': return <CheckCircle className="h-4 w-4" />;
      default: return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'diagnostic': return 'bg-blue-100 text-blue-800';
      case 'gmao': return 'bg-green-100 text-green-800';
      case 'security': return 'bg-red-100 text-red-800';
      case 'payment': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Assistant Technique
              </h1>
              <p className="text-muted-foreground">
                Chatbot intelligent pour résoudre vos problèmes techniques
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Chat d'Assistance
                </CardTitle>
                <CardDescription>
                  Décrivez votre problème et obtenez des solutions personnalisées
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {message.type === 'user' ? 
                          <User className="h-4 w-4" /> : 
                          <Bot className="h-4 w-4" />
                        }
                      </div>
                      
                      <div className={`max-w-[80%] ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`rounded-lg p-3 ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-foreground'
                        }`}>
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{message.timestamp.toLocaleTimeString()}</span>
                          {message.category && (
                            <Badge className={getCategoryColor(message.category)}>
                              {getCategoryIcon(message.category)}
                              <span className="ml-1 capitalize">{message.category}</span>
                            </Badge>
                          )}
                        </div>
                        
                        {message.type === 'bot' && (
                          <div className="flex items-center gap-1 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => copyToClipboard(message.content)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleFeedback(message.id, true)}
                            >
                              <ThumbsUp className={`h-3 w-3 ${message.helpful === true ? 'text-green-600' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => handleFeedback(message.id, false)}
                            >
                              <ThumbsDown className={`h-3 w-3 ${message.helpful === false ? 'text-red-600' : ''}`} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Input */}
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Décrivez votre problème technique..."
                      className="flex-1 min-h-[44px] max-h-32 resize-none"
                      rows={1}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isTyping}
                      size="sm"
                      className="h-11"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Common Issues */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Problèmes Fréquents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {commonBugSolutions.map((solution) => (
                  <div
                    key={solution.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setInputMessage(solution.title)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getCategoryIcon(solution.category)}
                      <span className="font-medium text-sm">{solution.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{solution.description}</p>
                    <Badge 
                      variant="outline" 
                      className={`mt-1 text-xs ${
                        solution.severity === 'critical' ? 'border-red-200 text-red-700' :
                        solution.severity === 'high' ? 'border-orange-200 text-orange-700' :
                        solution.severity === 'medium' ? 'border-yellow-200 text-yellow-700' :
                        'border-green-200 text-green-700'
                      }`}
                    >
                      {solution.severity}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}