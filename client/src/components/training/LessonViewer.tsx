import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  Target,
  BookOpen,
  Code,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Award
} from "lucide-react";
import { TrainingLesson } from "@/data/trainingContent";
import { useToast } from "@/hooks/use-toast";

interface LessonViewerProps {
  lesson: TrainingLesson;
  onComplete: (lessonId: string) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function LessonViewer({ 
  lesson, 
  onComplete, 
  onNext, 
  onPrevious, 
  isFirst = false, 
  isLast = false 
}: LessonViewerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showExercises, setShowExercises] = useState(false);
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<string, number>>({});
  const [animationState, setAnimationState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const { toast } = useToast();

  const handleStepComplete = (stepIndex: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepIndex);
    setCompletedSteps(newCompleted);
    
    toast({
      title: "Étape terminée",
      description: `Étape "${lesson.content.steps[stepIndex].title}" complétée`,
    });

    // Auto-advance to next step
    if (stepIndex < lesson.content.steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    } else {
      setShowExercises(true);
    }
  };

  const handleExerciseAnswer = (exerciseIndex: number, questionIndex: number, answerIndex: number) => {
    const key = `${exerciseIndex}-${questionIndex}`;
    setExerciseAnswers(prev => ({
      ...prev,
      [key]: answerIndex
    }));
  };

  const handleLessonComplete = () => {
    onComplete(lesson.id);
    toast({
      title: "Leçon terminée !",
      description: `Vous avez complété "${lesson.title}" avec succès`,
    });
  };

  const currentStepData = lesson.content.steps[currentStep];
  const progress = ((completedSteps.size / lesson.content.steps.length) * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{lesson.title}</CardTitle>
              <div className="flex items-center space-x-4 mt-2 text-muted-foreground">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{lesson.duration}</span>
                </div>
                <Badge variant="outline">
                  Étape {currentStep + 1} sur {lesson.content.steps.length}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{Math.round(progress)}%</div>
              <div className="text-sm text-muted-foreground">Progression</div>
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
      </Card>

      {/* Introduction */}
      {currentStep === 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <span>Introduction</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg leading-relaxed">{lesson.content.introduction}</p>
            
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <h4 className="font-semibold flex items-center mb-2">
                <Target className="w-4 h-4 mr-2 text-blue-600" />
                Objectifs d'apprentissage
              </h4>
              <ul className="space-y-1">
                {lesson.content.objectives.map((objective, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-600" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button 
              onClick={() => setCurrentStep(1)}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-lg py-6"
              size="lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Commencer la leçon
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      {!showExercises && currentStepData && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{currentStepData.title}</span>
              {completedSteps.has(currentStep) && (
                <CheckCircle className="w-6 h-6 text-green-600" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg leading-relaxed">{currentStepData.description}</p>

            {/* Animation Interactive Améliorée */}
            {currentStepData.animation && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-inner">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full mb-4 animate-pulse shadow-lg">
                    <Play className="w-10 h-10" />
                  </div>
                  <h3 className="font-bold text-xl text-blue-800 dark:text-blue-200 mb-2">
                    🎬 Animation Interactive
                  </h3>
                  <p className="text-blue-700 dark:text-blue-300 text-lg font-semibold">
                    {currentStepData.animation}
                  </p>
                </div>
                
                {/* Simulation industrielle avancée avec équipements réels */}
                <div className="mb-6">
                  <div className="machinery-simulation">
                    {/* Engrenages rotatifs */}
                    <div 
                      className={`machinery-gear ${animationState === 'playing' ? 'rotating' : ''}`}
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        top: '50px', 
                        left: '50px',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>
                    <div 
                      className={`machinery-gear ${animationState === 'playing' ? 'rotating' : ''}`}
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        top: '70px', 
                        left: '130px',
                        animationDirection: 'reverse',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>

                    {/* Manomètre de pression */}
                    <div className="pressure-gauge" style={{ top: '180px', left: '80px' }}>
                      <div 
                        className={`pressure-indicator ${animationState === 'playing' ? 'active' : ''}`}
                        style={{ 
                          animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                        }}
                      ></div>
                    </div>

                    {/* Canalisations avec flux */}
                    <div className="fluid-pipe" style={{ top: '150px', left: '20px', width: '200px' }}>
                      <div 
                        className={`fluid-flow ${animationState === 'playing' ? 'active' : ''}`}
                        style={{ 
                          animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                        }}
                      ></div>
                    </div>
                    <div className="fluid-pipe" style={{ top: '220px', left: '150px', width: '120px' }}>
                      <div 
                        className={`fluid-flow ${animationState === 'playing' ? 'active' : ''}`}
                        style={{ 
                          animationDelay: '1s',
                          animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                        }}
                      ></div>
                    </div>

                    {/* Thermomètre */}
                    <div className="temperature-gauge" style={{ top: '40px', right: '60px' }}>
                      <div 
                        className={`temperature-mercury ${animationState === 'playing' ? 'rising' : ''}`}
                        style={{ 
                          height: animationState === 'stopped' ? '20%' : undefined,
                          animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                        }}
                      ></div>
                    </div>

                    {/* Capteurs de vibration */}
                    <div 
                      className={`vibration-sensor ${animationState === 'playing' ? 'shaking' : ''}`}
                      style={{ 
                        top: '120px', 
                        left: '180px',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>
                    <div 
                      className={`vibration-sensor ${animationState === 'playing' ? 'shaking' : ''}`}
                      style={{ 
                        top: '60px', 
                        left: '220px',
                        animationDelay: '0.1s',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>

                    {/* Robot de maintenance */}
                    <div 
                      className={`maintenance-robot ${animationState === 'playing' ? 'moving' : ''}`}
                      style={{ 
                        bottom: '20px', 
                        left: '20px',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>

                    {/* Indicateurs d'alerte */}
                    <div 
                      className={`alert-indicator ${animationState === 'playing' ? 'critical' : ''}`}
                      style={{ 
                        top: '20px', 
                        left: '20px',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>
                    <div 
                      className={`alert-indicator ${animationState === 'playing' ? 'critical' : ''}`}
                      style={{ 
                        top: '20px', 
                        left: '40px',
                        animationDelay: '0.5s',
                        animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                      }}
                    ></div>

                    {/* Overlay de diagnostic */}
                    {animationState === 'playing' && (
                      <div className="diagnostic-overlay">
                        <div 
                          className="diagnostic-line scanning"
                          style={{ 
                            animationPlayState: animationState === 'paused' ? 'paused' : 'running'
                          }}
                        ></div>
                      </div>
                    )}

                    {/* Panneau de statut */}
                    <div className="status-panel">
                      <div>STATUS: {animationState === 'playing' ? 'RUNNING' : animationState === 'paused' ? 'PAUSED' : 'STOPPED'}</div>
                      <div>TEMP: {animationState === 'playing' ? '85°C' : '25°C'}</div>
                      <div>PRESS: {animationState === 'playing' ? '4.2 bar' : '0.0 bar'}</div>
                      <div>VIBR: {animationState === 'playing' ? '5.1 mm/s' : '0.0 mm/s'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Indicateur d'état d'animation */}
                <div className="text-center mb-4">
                  <Badge 
                    variant="outline" 
                    className={`${
                      animationState === 'playing' ? 'border-green-500 text-green-700 bg-green-50' : 
                      animationState === 'paused' ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
                      'border-gray-500 text-gray-700 bg-gray-50'
                    }`}
                  >
                    {animationState === 'playing' ? '▶️ En cours' : 
                     animationState === 'paused' ? '⏸️ En pause' : '⏹️ Arrêtée'}
                  </Badge>
                </div>
                
                {/* Contrôles interactifs */}
                <div className="flex justify-center space-x-3">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className={`bg-white/70 hover:bg-white/90 shadow-md transition-all ${
                      animationState === 'stopped' ? 'animate-pulse-glow' : ''
                    }`}
                    onClick={() => {
                      console.log("Animation lancée - État précédent:", animationState);
                      setAnimationState('playing');
                      toast({
                        title: "🎬 Animation lancée",
                        description: "Simulation interactive démarrée avec succès",
                      });
                    }}
                    disabled={animationState === 'playing'}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {animationState === 'playing' ? 'En cours...' : 'Lancer'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white/50 hover:bg-white/80"
                    onClick={() => {
                      console.log("Animation pause/reprise - État précédent:", animationState);
                      if (animationState === 'playing') {
                        setAnimationState('paused');
                        toast({
                          title: "⏸️ Animation en pause",
                          description: "Vous pouvez reprendre à tout moment",
                        });
                      } else if (animationState === 'paused') {
                        setAnimationState('playing');
                        toast({
                          title: "▶️ Animation reprise",
                          description: "Simulation relancée",
                        });
                      }
                    }}
                    disabled={animationState === 'stopped'}
                  >
                    {animationState === 'playing' ? '⏸️ Pause' : '▶️ Reprendre'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-white/50 hover:bg-white/80"
                    onClick={() => {
                      console.log("Animation redémarrée - État précédent:", animationState);
                      setAnimationState('stopped');
                      setTimeout(() => {
                        setAnimationState('playing');
                      }, 100);
                      toast({
                        title: "🔄 Animation redémarrée",
                        description: "Simulation relancée depuis le début",
                      });
                    }}
                  >
                    🔄 Recommencer
                  </Button>
                </div>
              </div>
            )}

            {/* Code Example */}
            {currentStepData.code && (
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <div className="flex items-center mb-2">
                  <Code className="w-4 h-4 mr-2" />
                  <span className="text-sm font-semibold">Exemple de code</span>
                </div>
                <pre className="text-sm">
                  <code>{currentStepData.code}</code>
                </pre>
              </div>
            )}

            {/* Tips */}
            {currentStepData.tips && currentStepData.tips.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg">
                <h4 className="font-semibold flex items-center mb-2">
                  <Lightbulb className="w-4 h-4 mr-2 text-yellow-600" />
                  Conseils pratiques
                </h4>
                <ul className="space-y-1">
                  {currentStepData.tips.map((tip, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-yellow-600 mr-2">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interactive Element Enhanced avec simulation réelle */}
            {currentStepData.interactive && (
              <div className={`bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 rounded-xl border-2 transition-all duration-300 ${
                simulationRunning ? 'border-green-500 bg-green-100' : 'border-green-200 dark:border-green-800'
              }`}>
                <div className="text-center mb-4">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full mb-3 transition-all ${
                    simulationRunning ? 'animate-bounce scale-110' : 'animate-pulse'
                  }`}>
                    <Lightbulb className="w-8 h-8" />
                  </div>
                  <div className="font-bold text-green-800 dark:text-green-200 text-lg mb-2">
                    💡 Exercice Interactif
                  </div>
                  <p className="text-green-700 dark:text-green-300">
                    Cette section comprend des éléments interactifs pour pratiquer les concepts.
                  </p>
                  
                  {/* Indicateur de simulation */}
                  <div className="mt-3">
                    <Badge 
                      variant="outline" 
                      className={`${
                        simulationRunning ? 'border-green-500 text-green-700 bg-green-50 animate-pulse' : 
                        'border-gray-500 text-gray-700 bg-gray-50'
                      }`}
                    >
                      {simulationRunning ? '🔄 Simulation en cours' : '⏹️ Simulation arrêtée'}
                    </Badge>
                  </div>
                </div>
                
                {/* Zone de simulation interactive */}
                {simulationRunning && (
                  <div className="bg-white/50 p-4 rounded-lg mb-4 border border-green-300">
                    <div className="flex justify-center items-center space-x-2 mb-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
                      <div className="w-3 h-3 bg-purple-500 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
                    </div>
                    <p className="text-center text-sm text-green-700 font-medium">
                      ✨ Exercice interactif en cours d'exécution...
                    </p>
                  </div>
                )}
                
                <div className="flex justify-center space-x-3">
                  <Button 
                    variant="default" 
                    className={`bg-green-600 hover:bg-green-700 transition-all ${
                      !simulationRunning ? 'animate-pulse-glow' : 'scale-105'
                    }`}
                    onClick={() => {
                      console.log("Exercice interactif démarré/arrêté - État précédent:", simulationRunning);
                      setSimulationRunning(!simulationRunning);
                      toast({
                        title: simulationRunning ? "⏹️ Exercice arrêté" : "🎯 Exercice démarré",
                        description: simulationRunning ? "Simulation terminée" : "Simulation interactive lancée avec succès",
                      });
                    }}
                  >
                    {simulationRunning ? (
                      <>
                        ⏹ Arrêter la simulation
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Lancer la simulation
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      console.log("Aide affichée pour exercice interactif");
                      toast({
                        title: "📚 Aide disponible",
                        description: "Consultez les conseils pratiques ci-dessus",
                      });
                    }}
                  >
                    💡 Aide
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Précédent
              </Button>
              
              <Button
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                onClick={() => handleStepComplete(currentStep)}
                disabled={completedSteps.has(currentStep)}
                size="lg"
              >
                {completedSteps.has(currentStep) ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    ✅ Terminé
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5 mr-2" />
                    Marquer comme terminé
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exercises */}
      {showExercises && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-orange-600" />
              <span>Exercices pratiques</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {lesson.content.exercises.map((exercise, exerciseIndex) => (
              <div key={exerciseIndex} className="border p-4 rounded-lg">
                <h4 className="font-semibold mb-2">{exercise.title}</h4>
                <p className="text-muted-foreground mb-4">{exercise.description}</p>
                
                {exercise.type === 'quiz' && exercise.questions && (
                  <div className="space-y-4">
                    {exercise.questions.map((question, questionIndex) => (
                      <div key={questionIndex} className="space-y-2">
                        <p className="font-medium">{question.question}</p>
                        <div className="space-y-1">
                          {question.answers.map((answer, answerIndex) => (
                            <label
                              key={answerIndex}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`exercise-${exerciseIndex}-question-${questionIndex}`}
                                value={answerIndex}
                                onChange={() => handleExerciseAnswer(exerciseIndex, questionIndex, answerIndex)}
                                className="form-radio"
                              />
                              <span>{answer}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {exercise.type === 'simulation' && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                    <p className="text-blue-800 dark:text-blue-200">
                      🔬 Simulation interactive disponible - cliquez pour lancer
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Démarrer la simulation
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <Button onClick={handleLessonComplete} className="w-full">
              <Award className="w-4 h-4 mr-2" />
              Terminer la leçon
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirst}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Leçon précédente
        </Button>
        
        <Button
          onClick={onNext}
          disabled={isLast}
        >
          Leçon suivante
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Resources */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Ressources complémentaires</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {lesson.content.resources.map((resource, index) => (
              <li key={index} className="flex items-center">
                <BookOpen className="w-4 h-4 mr-2 text-primary" />
                <span>{resource}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}