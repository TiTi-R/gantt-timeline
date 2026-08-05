import Joi from 'joi';

export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      error.isJoi = true;
      throw error;
    }
    req[property] = value;
    next();
  };
}

// Common schemas
export const schemas = {
  projectCreate: Joi.object({
    name: Joi.string().required().min(1).max(500),
    description: Joi.string().allow('', null).max(2000),
    study_id: Joi.string().allow('', null).max(100),
    indication: Joi.string().allow('', null).max(200),
    start_date: Joi.string().isoDate().allow('', null),
    end_date: Joi.string().isoDate().allow('', null),
    status: Joi.string().valid('draft', 'active', 'completed', 'archived').allow(null),
  }),

  taskCreate: Joi.object({
    name: Joi.string().required().min(1).max(500),
    phase_id: Joi.number().integer().allow(null),
    parent_id: Joi.number().integer().allow(null),
    start_date: Joi.string().isoDate().required(),
    end_date: Joi.string().isoDate().required(),
    duration_days: Joi.number().integer().min(0).allow(null),
    progress: Joi.number().min(0).max(1).allow(null),
    task_type: Joi.string().valid('project', 'task', 'milestone').allow(null),
    is_milestone: Joi.boolean().allow(null),
    color: Joi.string().allow('', null).max(20),
    notes: Joi.string().allow('', null).max(5000),
    resource_ids: Joi.array().items(Joi.number().integer()).allow(null),
  }),

  taskUpdate: Joi.object({
    name: Joi.string().min(1).max(500),
    phase_id: Joi.number().integer().allow(null),
    parent_id: Joi.number().integer().allow(null),
    start_date: Joi.string().isoDate(),
    end_date: Joi.string().isoDate(),
    duration_days: Joi.number().integer().min(0),
    progress: Joi.number().min(0).max(1),
    task_type: Joi.string().valid('project', 'task', 'milestone'),
    is_milestone: Joi.boolean(),
    color: Joi.string().allow('', null).max(20),
    notes: Joi.string().allow('', null).max(5000),
    resource_ids: Joi.array().items(Joi.number().integer()),
  }).min(1),

  dependencyCreate: Joi.object({
    predecessor_id: Joi.number().integer().required(),
    successor_id: Joi.number().integer().required(),
    dependency_type: Joi.string().valid('FS', 'SS', 'FF', 'SF'),
    lag_days: Joi.number().integer().default(0),
  }),
};
