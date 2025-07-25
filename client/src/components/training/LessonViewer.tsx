import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
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

    if (newCompleted.size === lesson.content.steps.length) {
      toast({
        title: "✅ Leçon terminée!",
        description: "Vous pouvez maintenant passer aux exercices ou à la leçon suivante.",
      });
    }
  };

  const handleExerciseAnswer = (questionId: string, answer: number) => {
    setExerciseAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleQuizComplete = () => {
    const exercises = lesson.content.exercises || [];
    const totalQuestions = exercises.reduce((total, exercise) => 
      total + (exercise.questions?.length || 0), 0
    );
    
    let correctAnswers = 0;
    exercises.forEach(exercise => {
      exercise.questions?.forEach((question, qIndex) => {
        const questionId = `${exercise.title}-${qIndex}`;
        if (exerciseAnswers[questionId] === question.correct) {
          correctAnswers++;
        }
      });
    });

    const score = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    toast({
      title: score >= 70 ? "🎉 Quiz réussi!" : "📚 Continuez vos efforts",
      description: `Score: ${score.toFixed(0)}% (${correctAnswers}/${totalQuestions})`,
      variant: score >= 70 ? "default" : "destructive"
    });

    if (score >= 70) {
      onComplete(lesson.id);
    }
  };

  // Vérifications de sécurité
  if (!lesson || !lesson.content || !lesson.content.steps || lesson.content.steps.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Aucune leçon disponible.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepData = lesson.content.steps[currentStep];
  const progress = ((currentStep + 1) / lesson.content.steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {lesson.title}
              </CardTitle>
              <p className="text-blue-600 dark:text-blue-400 mt-2">{lesson.content.introduction}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="px-3 py-1">
                <Clock className="w-4 h-4 mr-1" />
                {lesson.duration}
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                <Target className="w-4 h-4 mr-1" />
                Fondamental
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress */}
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progression</span>
            <span className="text-sm text-gray-600">{currentStep + 1} / {lesson.content.steps.length}</span>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="mt-2 text-xs text-gray-500">
            {completedSteps.size} étape(s) terminée(s)
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {!showExercises && currentStepData && currentStep < lesson.content.steps.length && (
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

            {/* Key Points */}
            {currentStepData.tips && currentStepData.tips.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2" />
                  Points clés
                </h4>
                <ul className="space-y-2">
                  {currentStepData.tips.map((point, index) => (
                    <li key={index} className="flex items-start">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-blue-700 dark:text-blue-300">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interactive Element */}
            {currentStepData.interactive && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 rounded-xl border border-green-200 dark:border-green-800">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 text-white rounded-full mb-3">
                    <Code className="w-8 h-8" />
                  </div>
                  <div className="font-bold text-green-800 dark:text-green-200 text-lg mb-2">
                    💡 Exercice Pratique
                  </div>
                  <p className="text-green-700 dark:text-green-300">
                    Cette section comprend des exercices pratiques pour appliquer les concepts appris.
                  </p>
                </div>
              </div>
            )}

            {/* Step Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Précédent
              </Button>

              <div className="flex space-x-3">
                {!completedSteps.has(currentStep) && (
                  <Button
                    onClick={() => handleStepComplete(currentStep)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marquer comme terminé
                  </Button>
                )}

                <Button
                  onClick={() => setCurrentStep(Math.min(lesson.content.steps.length - 1, currentStep + 1))}
                  disabled={currentStep >= lesson.content.steps.length - 1}
                  className="flex items-center"
                >
                  Suivant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exercises Section */}
      {showExercises && lesson.content.exercises && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="w-6 h-6 mr-2 text-yellow-600" />
              Quiz d'évaluation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {lesson.content.exercises.map((exercise, exerciseIndex) => (
              <div key={`exercise-${exerciseIndex}`} className="p-6 border rounded-xl">
                <h3 className="font-semibold mb-4 text-xl text-blue-800">{exercise.title}</h3>
                <p className="text-gray-600 mb-6">{exercise.description}</p>
                
                {exercise.questions?.map((question, questionIndex) => {
                  const questionId = `${exercise.title}-${questionIndex}`;
                  return (
                    <div key={questionId} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h4 className="font-semibold mb-4 text-lg">
                        Question {questionIndex + 1}: {question.question}
                      </h4>
                      <div className="space-y-2">
                        {question.answers.map((answer, answerIndex) => (
                          <label
                            key={answerIndex}
                            className="flex items-center p-3 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={questionId}
                              value={answerIndex}
                              onChange={() => handleExerciseAnswer(questionId, answerIndex)}
                              className="mr-3"
                            />
                            <span>{answer}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex justify-center pt-6">
              <Button
                onClick={handleQuizComplete}
                className="bg-blue-600 hover:bg-blue-700 px-8 py-3"
                disabled={
                  lesson.content.exercises.reduce((total, exercise) => 
                    total + (exercise.questions?.length || 0), 0
                  ) !== Object.keys(exerciseAnswers).length
                }
              >
                <Award className="w-5 h-5 mr-2" />
                Valider le quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirst}
          className="flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Leçon précédente
        </Button>

        <div className="flex space-x-3">
          {!showExercises && lesson.content.steps && completedSteps.size === lesson.content.steps.length && lesson.content.exercises && (
            <Button
              onClick={() => setShowExercises(true)}
              className="bg-yellow-600 hover:bg-yellow-700 flex items-center"
            >
              <Award className="w-4 h-4 mr-2" />
              Passer au quiz
            </Button>
          )}

          {!showExercises && lesson.content.exercises && lesson.content.exercises.length > 0 && (
            <Button
              onClick={() => setShowExercises(true)}
              variant="outline"
              className="flex items-center"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Voir le quiz
            </Button>
          )}

          {showExercises && (
            <Button
              onClick={() => setShowExercises(false)}
              variant="outline"
              className="flex items-center"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Retour aux leçons
            </Button>
          )}

          <Button
            onClick={onNext}
            disabled={isLast}
            className="flex items-center"
          >
            Leçon suivante
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}