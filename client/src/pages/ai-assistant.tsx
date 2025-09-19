import { Header } from "@/components/header";
import AIAssistantChat from "@/components/ai-assistant-chat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Wrench, 
  BarChart3, 
  AlertTriangle,
  Clock,
  Users,
  Settings
} from "lucide-react";

export default function AIAssistantPage() {
  const assistantFeatures = [
    {
      icon: <Wrench className="h-5 w-5" />,
      title: "Equipment Analysis",
      description: "Get AI-powered insights for equipment diagnostics and troubleshooting"
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Maintenance Planning",
      description: "Smart recommendations for preventive maintenance schedules"
    },
    {
      icon: <AlertTriangle className="h-5 w-5" />,
      title: "Problem Solving",
      description: "Instant help with technical issues and error resolution"
    },
    {
      icon: <Clock className="h-5 w-5" />,
      title: "24/7 Availability",
      description: "Always available to assist with your maintenance questions"
    }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="ai-assistant-page">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold" data-testid="page-title">
                AI Assistant
              </h1>
              <p className="text-muted-foreground" data-testid="page-description">
                Get intelligent assistance for maintenance management and equipment diagnostics
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Claude AI Powered
            </Badge>
            <Badge variant="outline">GMAO Specialized</Badge>
            <Badge variant="outline">Maintenance Expert</Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* AI Chat Interface */}
          <div className="lg:col-span-2">
            <AIAssistantChat 
              initialMessage="Hello! I'm your Smart GMAO AI assistant. I can help you with:

• Equipment diagnostics and troubleshooting
• Maintenance planning and scheduling
• Technical problem solving
• Best practices for industrial maintenance
• Predictive analytics insights

How can I assist you today?"
              placeholder="Ask me about equipment, maintenance, or any technical questions..."
              title="AI Chat Assistant"
              description="Powered by Claude AI - Specialized in maintenance management"
            />
          </div>

          {/* Sidebar with Features */}
          <div className="space-y-6">
            {/* Features Overview */}
            <Card data-testid="features-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Assistant Capabilities
                </CardTitle>
                <CardDescription>
                  What our AI assistant can help you with
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assistantFeatures.map((feature, index) => (
                  <div key={index} className="flex gap-3" data-testid={`feature-${index}`}>
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{feature.title}</h4>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card data-testid="quick-actions-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Try these common assistance topics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => {
                    const chatInput = document.querySelector('[data-testid="input-message"]') as HTMLTextAreaElement;
                    if (chatInput) {
                      chatInput.value = "How do I diagnose a motor vibration issue?";
                      chatInput.focus();
                    }
                  }}
                  data-testid="quick-action-motor"
                >
                  <div>
                    <div className="font-medium text-sm">Motor Diagnostics</div>
                    <div className="text-xs text-muted-foreground">Diagnose motor issues</div>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => {
                    const chatInput = document.querySelector('[data-testid="input-message"]') as HTMLTextAreaElement;
                    if (chatInput) {
                      chatInput.value = "Create a preventive maintenance schedule for industrial pumps";
                      chatInput.focus();
                    }
                  }}
                  data-testid="quick-action-maintenance"
                >
                  <div>
                    <div className="font-medium text-sm">Maintenance Planning</div>
                    <div className="text-xs text-muted-foreground">Schedule preventive maintenance</div>
                  </div>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-left h-auto p-3"
                  onClick={() => {
                    const chatInput = document.querySelector('[data-testid="input-message"]') as HTMLTextAreaElement;
                    if (chatInput) {
                      chatInput.value = "What are the safety procedures for electrical equipment maintenance?";
                      chatInput.focus();
                    }
                  }}
                  data-testid="quick-action-safety"
                >
                  <div>
                    <div className="font-medium text-sm">Safety Guidelines</div>
                    <div className="text-xs text-muted-foreground">Equipment safety procedures</div>
                  </div>
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card data-testid="tips-card">
              <CardHeader>
                <CardTitle className="text-sm">💡 Tips for Better Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Be specific about equipment types and symptoms</p>
                  <p>• Include error codes or fault descriptions</p>
                  <p>• Mention equipment age and operating conditions</p>
                  <p>• Ask follow-up questions for detailed guidance</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}