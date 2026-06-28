from flask import Blueprint, jsonify

example_bp = Blueprint('example', __name__, url_prefix='/api')

@example_bp.route('/status', methods=['GET'])
def status():
    """Rota de verificação de status da API."""
    return jsonify({
        'status': 'online',
        'mensagem': 'API do Vago Sistema PS funcionando!'
    }), 200
