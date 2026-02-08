# AI Model Registry Strategy

A robust AI Model Registry is crucial for managing the lifecycle of machine learning models in a production environment. It serves as a central hub for versioning, storing, and tracking models, ensuring reproducibility, and facilitating continuous integration/continuous delivery (CI/CD) of ML models.

## Key Features of a World-Class Model Registry:

1.  **Model Versioning:** Automatically track different versions of models (e.g., v1, v1.1, v2).
2.  **Metadata Management:** Store essential metadata for each model version, such as:
    *   Training data used (link to dataset version).
    *   Training code version (Git SHA).
    *   Hyperparameters.
    *   Performance metrics (accuracy, precision, recall, F1, MAE, RMSE).
    *   Model format (ONNX, TensorFlow SavedModel, PyTorch Script).
    *   Dependencies (Python packages, framework versions).
    *   Responsible team/owner.
3.  **Model Storage:** Securely store model artifacts (e.g., ONNX files, TensorFlow SavedModels) in an accessible location (e.g., S3, MinIO, Azure Blob Storage, Google Cloud Storage).
4.  **Deployment Stage Tracking:** Track which model version is deployed to which environment (development, staging, production).
5.  **Access Control:** Implement granular permissions for who can register, approve, or deploy models.
6.  **Auditability:** Log all actions related to model lifecycle for compliance and debugging.
7.  **Integration with CI/CD/CT:** Seamless integration with ML pipelines for automated testing, deployment, and continuous retraining.

## Proposed Implementation for NextGen Marketplace:

Given the project's Kubernetes-native architecture and preference for cost-effective, open-source solutions where possible, a multi-faceted approach is recommended:

### 1. Model Storage (MinIO)

*   **MinIO:** Leverage the existing MinIO (or an S3-compatible cloud storage) for storing model artifacts (e.g., `tinyllama-q4.model.onnx`).
*   **Structure:** Organize models with clear versioning: `minio://ml-models/tinyllama/v1.0/tinyllama-q4.model.onnx`.

### 2. Model Metadata & Versioning (Database + Git)

*   **Prisma Database:** Create a new Prisma model (e.g., `MLModelVersion`) to store metadata and link to storage locations.
    ```prisma
    model MLModelVersion {
      id            String     @id @default(cuid())
      name          String
      version       String
      description   String?
      format        String     // ONNX, TF_SAVED_MODEL, PYTORCH_SCRIPT
      storagePath   String     // e.g., s3://ml-models/tinyllama/v1.0/tinyllama-q4.model.onnx
      trainingData  String?    // Link/ID to training dataset version
      trainingCode  String?    // Git SHA of training code
      metrics       Json?      // { "accuracy": 0.95, "mae": 0.05 }
      dependencies  String[]   @default([]) // Python package versions, etc.
      status        MLModelStatus @default(PENDING_REVIEW) // PENDING_REVIEW, APPROVED, REJECTED, DEPLOYED
      deployedTo    String[]   @default([]) // dev, staging, production
      createdAt     DateTime   @default(now())
      updatedAt     DateTime   @updatedAt

      @@unique([name, version])
      @@map("ml_model_versions")
    }

    enum MLModelStatus {
      PENDING_REVIEW
      APPROVED
      REJECTED
      DEPLOYED
      ARCHIVED
    }
    ```
*   **Git:** Track changes to training code and model configurations directly in Git, using Git SHA for `trainingCode` metadata.

### 3. CI/CD Integration (GitHub Actions)

*   **Automated Registration:** Extend the ML training pipeline (e.g., `tinyllama_finetuning.py` or a dedicated training workflow) to:
    *   Calculate performance metrics after training.
    *   Upload the trained/quantized ONNX model to MinIO.
    *   Register the new model version and its metadata in the Prisma `MLModelVersion` table.
*   **Deployment Approval:** Implement a manual approval step in GitHub Actions for promoting a model from staging to production.

### 4. ML Microservice Integration

*   The `ml-service` should retrieve the `storagePath` for the `APPROVED` and `DEPLOYED` model version from the `MLModelVersion` table during startup or dynamically.
*   It then downloads the model artifact from MinIO and loads it into memory for inference.

## Next Steps:

1.  **Implement `MLModelVersion` Prisma model and `MLModelStatus` enum.**
2.  **Extend `ml-training` scripts** to perform model registration.
3.  **Modify `ml-service`** to fetch models from MinIO based on database entries.
4.  **Integrate model promotion/rollback** into ML CI/CD pipeline.
