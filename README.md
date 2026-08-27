# La roue de la chance

Une roue de la chance multi-participants : une console admin privée, de 2 à 7 choix, un lien à usage unique par participant et un tableau des résultats.

## Utilisation

1. Ouvrir la page : elle crée une session, ses choix (2 à 7) et le nombre de participants.
2. Conserver le lien admin privé.
3. Copier un lien individuel par participant : le serveur enregistre son premier tirage et le verrouille ensuite.
4. Le tableau admin montre l'avancement et le nombre de tirages par choix.
5. « Démarrer une nouvelle manche » efface les résultats et régénère les liens participants, pour empêcher la réutilisation des liens de la manche précédente.

## Déploiement Coolify

Créer une application à partir du dépôt GitHub, branche `main`, Build Pack `Dockerfile`, port `3000`.

Ajouter un volume persistant Coolify : source `/data`, destination `/data`. Sans ce volume, les sessions et résultats seraient perdus à chaque redéploiement.
