import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { offlineStorage } from '@/lib/offline-storage';
import { WifiOff, AlertTriangle, CheckCircle, Clock, Wrench } from 'lucide-react';

interface OfflineDiagnosticProps {
  onAddPendingAction: (action: any) => void;
}

export function OfflineDiagnostic({ onAddPendingAction }: OfflineDiagnosticProps) {
  const [formData, setFormData] = useState({
    equipmentType: '',
    equipmentId: '',
    zone: '',
    symptoms: '',
    urgency: 'medium'
  });
  const [result, setResult] = useState<any>(null);

  const handleDiagnose = () => {
    if (!formData.equipmentType || !formData.symptoms) {
      return;
    }

    // Perform offline diagnosis
    const diagnosis = offlineStorage.performOfflineDiagnosis(
      formData.equipmentType,
      formData.symptoms
    );

    setResult(diagnosis);

    // Add to pending actions for sync when online
    onAddPendingAction({
      type: 'diagnostic',
      data: {
        ...formData,
        results: JSON.stringify(diagnosis),
        status: 'completed',
        mlPrediction: false,
        confidence: diagnosis.confidence
      }
    });
  };

  const equipmentOptions = [
    'Moteur électrique',
    'Pompe hydraulique', 
    'Compresseur',
    'Ventilateur',
    'Grue portuaire',
    'Transporteur',
    'Variateur de fréquence',
    'Transformateur',
    'Réducteur',
    'Convoyeur'
  ];

  return (
    <div className="space-y-6">
      <Alert>
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          Mode offline activé. Le diagnostic utilise les données historiques locales.
          Les résultats seront synchronisés dès le retour de la connexion.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Diagnostic Offline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="equipmentType">Type d'équipement</Label>
              <Select
                value={formData.equipmentType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, equipmentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipmentId">ID Équipement</Label>
              <Input
                id="equipmentId"
                value={formData.equipmentId}
                onChange={(e) => setFormData(prev => ({ ...prev, equipmentId: e.target.value }))}
                placeholder="EQ-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zone">Zone/Secteur</Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => setFormData(prev => ({ ...prev, zone: e.target.value }))}
                placeholder="Zone A, Secteur 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency">Niveau d'urgence</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="high">Élevé</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptoms">Symptômes observés</Label>
            <Textarea
              id="symptoms"
              value={formData.symptoms}
              onChange={(e) => setFormData(prev => ({ ...prev, symptoms: e.target.value }))}
              placeholder="Décrivez les symptômes: vibrations, bruits, surchauffe, fuite, etc."
              rows={3}
            />
          </div>

          <Button 
            onClick={handleDiagnose}
            className="w-full"
            disabled={!formData.equipmentType || !formData.symptoms}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Analyser en mode offline
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Résultat du diagnostic offline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Confiance: {Math.round((result.confidence || 0) * 100)}%
              </Badge>
              <Badge variant="secondary">
                <WifiOff className="h-3 w-3 mr-1" />
                Mode offline
              </Badge>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm mb-1">Diagnostic:</h4>
                <p className="text-sm text-muted-foreground">{result.diagnosis}</p>
              </div>

              {result.solution && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Solution recommandée:</h4>
                  <p className="text-sm text-muted-foreground">{result.solution}</p>
                </div>
              )}

              {result.recommendations && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Recommandations:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {result.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <Wrench className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.similarCases && result.similarCases.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Cas similaires trouvés:</h4>
                  <div className="space-y-2">
                    {result.similarCases.slice(0, 2).map((case_: any, index: number) => (
                      <div key={index} className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            Match: {Math.round((case_.matchScore || 0) * 100)}%
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{case_.symptoms}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Ce diagnostic sera automatiquement sauvegardé et validé dès le retour de la connexion internet.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}