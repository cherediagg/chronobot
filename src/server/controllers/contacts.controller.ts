import { Request, Response } from 'express';
import { employeeStore } from '../employee-store';
import { chronoBotSingleton } from '../../chronobot-engine';

export class ContactsController {
  public static getContacts(req: Request, res: Response): void {
    res.json({
      employees: employeeStore.getEmployees(),
      file: employeeStore.getEmployeeFileDetails()
    });
  }

  public static getFileMeta(req: Request, res: Response): void {
    res.json({
      success: true,
      file: employeeStore.getEmployeeFileDetails()
    });
  }

  public static updateFile(req: Request, res: Response): void {
    const { rawJson } = req.body;
    const result = employeeStore.saveRawEmployeesFile(rawJson);
    chronoBotSingleton.reloadAuthorizedContacts('Fichero reescrito');
    res.json({
      ...result,
      employees: employeeStore.getEmployees(),
      file: employeeStore.getEmployeeFileDetails(),
      logs: chronoBotSingleton.getLogs(10)
    });
  }

  public static addContact(req: Request, res: Response): void {
    const employee = employeeStore.addEmployee(req.body);
    chronoBotSingleton.reloadAuthorizedContacts(`Contacto añadido: ${employee.nombre}`);
    res.json({
      success: true,
      employee,
      file: employeeStore.getEmployeeFileDetails(),
      logs: chronoBotSingleton.getLogs(10)
    });
  }

  public static updateContact(req: Request, res: Response): void {
    const id = String(req.params['id']);
    const employee = employeeStore.updateEmployee(id, req.body);
    if (employee) {
      chronoBotSingleton.reloadAuthorizedContacts(`Contacto actualizado: ${employee.nombre}`);
    }
    res.json({
      success: Boolean(employee),
      employee,
      file: employeeStore.getEmployeeFileDetails(),
      logs: chronoBotSingleton.getLogs(10)
    });
  }

  public static toggleAuthorization(req: Request, res: Response): void {
    const id = String(req.params['id']);
    const employee = employeeStore.toggleEmployeeActive(id);
    if (employee) {
      chronoBotSingleton.reloadAuthorizedContacts(`Permiso modificado: ${employee.nombre} (${employee.activo ? 'AUTORIZADO' : 'REVOCADO'})`);
    }
    res.json({
      success: Boolean(employee),
      employee,
      file: employeeStore.getEmployeeFileDetails(),
      logs: chronoBotSingleton.getLogs(10)
    });
  }

  public static deleteContact(req: Request, res: Response): void {
    const id = String(req.params['id']);
    const employee = employeeStore.deleteEmployee(id);
    if (employee) {
      chronoBotSingleton.reloadAuthorizedContacts(`Contacto eliminado: ${employee.nombre}`);
    }
    res.json({
      success: Boolean(employee),
      employee,
      file: employeeStore.getEmployeeFileDetails(),
      logs: chronoBotSingleton.getLogs(10)
    });
  }
}
