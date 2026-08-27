# La roue de la chance

Une roue de la chance multi-participants : une console admin privée, de 2 à 7 choix, un mode collectif anonyme ou un lien à usage unique par participant, et un tableau des résultats.

## Utilisation

1. Ouvrir la page : elle crée une session, ses choix (2 à 7) et le nombre de participants prévus.
2. Pour un grand groupe, choisir « Lien collectif anonyme » puis partager le lien unique affiché dans la console. Un cookie technique aléatoire limite chaque navigateur à un tirage, sans nom ni compte.
3. Le mode « Un lien différent par participant » reste disponible si des liens personnels sont préférables.
4. Le tableau admin montre l'avancement et le nombre de tirages par choix.
5. « Démarrer une nouvelle manche » efface les résultats. En mode anonyme, le même lien sert à la nouvelle manche ; en mode individuel, de nouveaux liens sont générés.

Le mode anonyme protège contre les doubles clics et les rechargements ordinaires. Une personne qui efface volontairement les cookies ou change de navigateur peut toutefois être reconnue comme un nouveau navigateur : c'est la limite incontournable d'un tirage totalement anonyme.

## Déploiement Coolify

Créer une application à partir du dépôt GitHub, branche `main`, Build Pack `Dockerfile`, port `3000`.

Ajouter un volume persistant Coolify : source `/data`, destination `/data`. Sans ce volume, les sessions et résultats seraient perdus à chaque redéploiement.
