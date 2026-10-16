"""
Script de Fine-Tuning con QLoRA / PEFT para entrenar Split-Reasoner sobre Qwen 2.5 o Llama 3.1.
Ejecución: python -m app.training.fine_tune_lora --dataset data/training_dataset.jsonl --model Qwen/Qwen2.5-7B-Instruct
"""

import os
import argparse


def train_reasoning_model(
    model_name: str = "Qwen/Qwen2.5-7B-Instruct",
    dataset_path: str = "ai_engine/data/training_dataset.jsonl",
    output_dir: str = "ai_engine/models/split_reasoner_lora",
    max_seq_length: int = 4096,
    batch_size: int = 2,
    epochs: int = 3
):
    print(f"[START] Iniciando preparación de Fine-Tuning para: {model_name}")
    print(f"[DIR] Dataset: {dataset_path}")
    print(f"[SAVE] Directorio de salida: {output_dir}")

    try:
        from unsloth import FastLanguageModel
        import torch
        from trl import SFTTrainer
        from transformers import TrainingArguments
        from datasets import load_dataset
    except ImportError:
        print("\n[AVISO] Dependencias de Entrenamiento:")
        print("Para ejecutar el fine-tuning en GPU, instala las librerías de entrenamiento:")
        print("pip install torch transformers datasets trl peft unsloth accelerate")
        print("\nEl pipeline de datos y el dataset JSONL ya están completamente listos y validados.")
        return

    # 1. Cargar modelo base en 4-bit para optimizar VRAM
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=max_seq_length,
        load_in_4bit=True
    )

    # 2. Configurar adaptadores LoRA sobre capas de atención
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth"
    )

    # 3. Cargar dataset
    dataset = load_dataset("json", data_files=dataset_path, split="train")

    def formatting_prompts_func(examples):
        convos = examples["conversations"]
        texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
        return {"text": texts}

    dataset = dataset.map(formatting_prompts_func, batched=True)

    # 4. Entrenador SFT
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=batch_size,
            gradient_accumulation_steps=4,
            warmup_steps=10,
            num_train_epochs=epochs,
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=1,
            output_dir=output_dir,
            save_strategy="epoch"
        ),
    )

    print("[EXEC] Comenzando entrenamiento de tensores...")
    trainer.train()

    print(f"[OK] Entrenamiento completado. Guardando adaptadores LoRA en {output_dir}")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-Tuning de Split-Reasoner con LoRA")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-7B-Instruct")
    parser.add_argument("--dataset", type=str, default="ai_engine/data/training_dataset.jsonl")
    parser.add_argument("--output", type=str, default="ai_engine/models/split_reasoner_lora")
    args = parser.parse_args()

    train_reasoning_model(
        model_name=args.model,
        dataset_path=args.dataset,
        output_dir=args.output
    )
