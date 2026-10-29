"""Blueprint registry. Order matches the previous router registration."""


def register(app):
    from flask_app.blueprints import auth, users, foods, meal_logs, ai_scan, recipes, nutrition, subscriptions, support, community, integrations, adventure, coaching, personalization, cloud_nutrition, training, push, internal, billing_webhook, social, communities
    app.register_blueprint(auth.bp)
    app.register_blueprint(users.bp)
    app.register_blueprint(foods.bp)
    app.register_blueprint(meal_logs.bp)
    app.register_blueprint(ai_scan.bp)
    app.register_blueprint(recipes.bp)
    app.register_blueprint(nutrition.bp)
    app.register_blueprint(subscriptions.bp)
    app.register_blueprint(support.bp)
    app.register_blueprint(community.bp)
    app.register_blueprint(integrations.bp)
    app.register_blueprint(adventure.bp)
    app.register_blueprint(coaching.bp)
    app.register_blueprint(personalization.bp)
    app.register_blueprint(cloud_nutrition.bp)
    app.register_blueprint(training.bp)
    app.register_blueprint(push.bp)
    app.register_blueprint(internal.bp)
    app.register_blueprint(billing_webhook.bp)
    app.register_blueprint(social.bp)
    app.register_blueprint(communities.bp)
    from flask_app import web_gateway  # browser routes under /api/* (cookie sessions -> /api/v1)
    app.register_blueprint(web_gateway.bp)
