export type QuestionType = "scale" | "boolean" | "text" | "select" | "boolean_text";

export interface QuestionDef {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
}

export const QUESTIONS: Record<"positionnement" | "satisfaction_chaud" | "satisfaction_froid", QuestionDef[]> = {
  positionnement: [
    { id: "p1", label: "Quel est votre niveau d'expérience dans ce domaine ?", type: "scale" },
    { id: "p2", label: "Avez-vous déjà suivi une formation similaire ?", type: "boolean" },
    { id: "p3", label: "Si oui, il y a combien de temps ?", type: "text" },
    { id: "p4", label: "Quel est votre poste actuel ?", type: "text" },
    { id: "p5", label: "Depuis combien d'années exercez-vous ce métier ?", type: "text" },
    { id: "p6", label: "Quels sont vos objectifs principaux pour cette formation ?", type: "text" },
    { id: "p7", label: "Quelles compétences souhaitez-vous développer en priorité ?", type: "text" },
    { id: "p8", label: "Avez-vous des contraintes particulières (handicap, langue, etc.) ?", type: "boolean_text" },
    { id: "p9", label: "Comment avez-vous entendu parler de cette formation ?", type: "text" },
    { id: "p10", label: "Quelles sont vos disponibilités et contraintes d'organisation ?", type: "text" },
  ],
  satisfaction_chaud: [
    { id: "sc1", label: "La formation a répondu à vos attentes.", type: "scale" },
    { id: "sc2", label: "Les objectifs pédagogiques ont été atteints.", type: "scale" },
    { id: "sc3", label: "Le contenu était adapté à votre niveau.", type: "scale" },
    { id: "sc4", label: "Le formateur maîtrisait son sujet.", type: "scale" },
    { id: "sc5", label: "Le formateur était disponible et à l'écoute.", type: "scale" },
    { id: "sc6", label: "Les supports pédagogiques étaient clairs et utiles.", type: "scale" },
    { id: "sc7", label: "La durée de la formation était adaptée.", type: "scale" },
    { id: "sc8", label: "Les conditions d'accueil et le lieu étaient satisfaisants.", type: "scale" },
    { id: "sc9", label: "Recommanderiez-vous cette formation à un collègue ?", type: "boolean" },
    { id: "sc10", label: "Qu'avez-vous le plus apprécié ?", type: "text" },
    { id: "sc11", label: "Qu'est-ce qui pourrait être amélioré ?", type: "text" },
  ],
  satisfaction_froid: [
    { id: "sf1", label: "Vous souvenez-vous des principaux apports de la formation ?", type: "scale" },
    { id: "sf2", label: "Les compétences acquises sont utiles dans votre travail.", type: "scale" },
    { id: "sf3", label: "Avez-vous pu mettre en pratique ce que vous avez appris ?", type: "boolean" },
    { id: "sf4", label: "À quelle fréquence appliquez-vous les acquis ?", type: "select", options: ["jamais", "parfois", "souvent", "toujours"] },
    { id: "sf5", label: "Votre niveau a-t-il progressé grâce à cette formation ?", type: "scale" },
    { id: "sf6", label: "Votre hiérarchie a-t-elle remarqué une évolution ?", type: "select", options: ["oui", "non", "non applicable"] },
    { id: "sf7", label: "Avez-vous rencontré des difficultés à appliquer les acquis ?", type: "boolean_text" },
    { id: "sf8", label: "Avez-vous eu besoin d'un accompagnement supplémentaire ?", type: "boolean" },
    { id: "sf9", label: "La formation a eu un impact positif sur votre travail au quotidien.", type: "scale" },
    { id: "sf10", label: "Avez-vous des suggestions pour améliorer la formation ?", type: "text" },
  ],
};

export const QUESTIONNAIRE_LABELS: Record<string, string> = {
  positionnement: "Positionnement d'entrée",
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
};
