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
              onClick={() => setCurrentStep(0)}
              className="w-full"
            >
              Commencer la leçon
              <ArrowRight className="w-4 h-4 ml-2" />
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

            {/* Animation Placeholder */}
            {currentStepData.animation && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-6 rounded-lg text-center">
                <div className="text-4xl mb-2">🎬</div>
                <div className="font-semibold text-purple-800 dark:text-purple-200">
                  {currentStepData.animation}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-300 mt-2">
                  Animation interactive disponible
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

            {/* Interactive Element */}
            {currentStepData.interactive && (
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <div className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  💡 Élément interactif
                </div>
                <p className="text-green-700 dark:text-green-300">
                  Cette section comprend des éléments interactifs pour pratiquer les concepts.
                </p>
                <Button variant="outline" size="sm" className="mt-2">
                  Lancer la simulation
                </Button>
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
                onClick={() => handleStepComplete(currentStep)}
                disabled={completedSteps.has(currentStep)}
              >
                {completedSteps.has(currentStep) ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Terminé
                  </>
                ) : (
                  <>
                    Marquer comme terminé
                    <ArrowRight className="w-4 h-4 ml-2" />
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