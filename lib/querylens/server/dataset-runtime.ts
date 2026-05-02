import {
  createDatabaseDatasetProfileStore,
  type QueryLensDatasetProfileStore,
} from "@/lib/querylens/server/profile-store"
import {
  createDatabaseDataAccess,
  type QueryLensDataAccess,
} from "@/lib/querylens/server/repositories"

export interface QueryLensDatasetRuntime {
  dataAccess: QueryLensDataAccess
  profileStore: QueryLensDatasetProfileStore
}

export async function getQueryLensDatasetRuntime(): Promise<QueryLensDatasetRuntime> {
  return {
    dataAccess: createDatabaseDataAccess(),
    profileStore: createDatabaseDatasetProfileStore(),
  }
}

export async function getQueryLensDataAccess(): Promise<QueryLensDataAccess> {
  return (await getQueryLensDatasetRuntime()).dataAccess
}
