# backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()
app = FastAPI()

# Configuración de CORS para permitir solicitudes desde tu frontend React
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key de OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    # Si la clave no está configurada, eleva un error claro
    print("ADVERTENCIA: La variable de entorno OPENAI_API_KEY no está configurada.")
    raise ValueError("La variable de entorno OPENAI_API_KEY no está configurada. Por favor, configúrala en un archivo .env en la carpeta 'backend'.")

# Inicializar el cliente asíncrono de OpenAI
openai_client = AsyncOpenAI(api_key=openai_api_key)

ECOMMERCE_TOOLS = [
    {
        "name": "filter_products",
        "description": "Filters products in an online store based on user criteria.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "e.g., shoes, shirts, etc."},
                "color": {"type": "string", "description": "e.g., red, blue, etc."},
                "max_price": {"type": "number", "description": "Maximum price in USD"},
            },
            "required": ["category"]
        },
        "type": "function"
    }
]

class SessionCreateResponse(BaseModel):
    ephemeral_key: str

@app.post("/session", response_model=SessionCreateResponse)
async def create_session():
    """
    Crea una nueva sesión para la API Realtime Voice de OpenAI, incluyendo las herramientas,
    y devuelve la clave efímera (client_secret).
    """
    print("Intentando crear una nueva sesión...")
    try:
        
        print(f"API Key cargada correctamente (longitud: {len(openai_api_key)}).")

        session = await openai_client.beta.realtime.sessions.create(
            # MODELO: Según las directrices "gpt-4o-realtime-preview-2024-12-17".
            model="gpt-4o-realtime-preview-2024-12-17",
            instructions="You are an E-commerce agent. Your main task is to help users find products by filtering them based on their voice commands. Use the 'filter_products' tool when the user asks to find specific products. If you cannot fulfill the request with the available tools, respond naturally and explain what you can do.",
            voice="alloy", # Voz de la IA 
            modalities=["audio", "text"], # Modos de interacción (audio para voz, texto para transcripciones/chat)
            tools=ECOMMERCE_TOOLS 
        )

        # Clave efímera a través de session.client_secret.value
        ephemeral_key_value = session.client_secret.value
        print(f"Clave efímera generada: {ephemeral_key_value[:10]}... (recortada por seguridad)") 

        return {"ephemeral_key": ephemeral_key_value}

    except Exception as e:
        print(f"Error al crear la sesión en el backend: {e}")
        # Detalla el error sin exponer la API key directamente
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al crear la sesión de OpenAI. Por favor, verifica tu API Key y que el modelo 'gpt-4o-realtime-preview-2024-12-17' esté disponible para tu cuenta. Detalle específico del error: {e}")

@app.get("/")
async def read_root():
    return {"message": "Bienvenido al Backend de VUEN AI E-commerce Agent. ¡El agente está listo!"}
