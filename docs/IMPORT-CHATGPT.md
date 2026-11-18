# Importer des QCM depuis ChatGPT

Dans ProLycée : **Kahoot > Import ChatGPT**, puis coller le JSON.

## Prompt à donner à ChatGPT

> Tu es professeur de bac pro TBAA. À partir du cours ci-dessous, génère [10] QCM de niveau [Terminale TBAA].
> Réponds UNIQUEMENT avec un bloc JSON valide, sans texte autour, exactement dans ce format :
> titre, classe (seconde, premiere ou terminale), questions (question, reponses [4 propositions],
> bonne_reponse [lettre A à D], temps [secondes], explication).
> Une seule bonne réponse, les 3 mauvaises doivent être plausibles, et varie la position de la bonne réponse.
> Cours : [coller le cours]

## Format

```json
{
  "titre": "Lecture de plan : cotation et légende",
  "classe": "terminale",
  "questions": [
    {
      "question": "Que représente la cote 2,50 sur ce plan ?",
      "reponses": ["La hauteur sous plafond", "La largeur de la pièce", "L'épaisseur du mur", "La surface en m²"],
      "bonne_reponse": "B",
      "temps": 30,
      "explication": "Une cote horizontale donne une dimension entre deux nus de murs."
    },
    {
      "type": "num",
      "question": "Surface d'une pièce de 4 m par 6 m ?",
      "valeur": 24,
      "tolerance": 0.5,
      "unite": "m²",
      "temps": 30
    }
  ]
}
```

Les plans (images, PDF) et les maquettes 3D (IFC, GLB) s'ajoutent ensuite dans l'éditeur, question par question.
Les questions « clic sur le plan » se créent dans l'éditeur (il faut dessiner la zone correcte).
