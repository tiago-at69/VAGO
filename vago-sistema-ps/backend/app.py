from flask import Flask
from controllers.example_controller import example_bp

app = Flask(__name__)

# Registro dos blueprints (controllers)
app.register_blueprint(example_bp)

if __name__ == '__main__':
    app.run(debug=True)
